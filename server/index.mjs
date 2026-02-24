import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import { db, initDb, createId } from './db.mjs';

const app = express();
const PORT = Number(process.env.API_PORT || 8787);
const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:4173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || '';
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || '';

const mailer =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

let firebaseAuth = null;
if (!admin.apps.length) {
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    });
  } else {
    try {
      admin.initializeApp();
    } catch {
      // Firebase Admin is optional in local dev.
    }
  }
}
if (admin.apps.length > 0) {
  firebaseAuth = admin.auth();
}

initDb();

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe || !stripeWebhookSecret) return res.status(400).send('Stripe webhook not configured');
  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).send('Missing signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch {
    return res.status(400).send('Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (order) {
        db.prepare('UPDATE orders SET status = ?, stripe_payment_intent = ? WHERE id = ?').run(
          'paid',
          String(session.payment_intent || ''),
          orderId,
        );
        const items = db.prepare('SELECT product_id FROM order_items WHERE order_id = ?').all(orderId);
        for (const item of items) {
          db.prepare('UPDATE products SET status = ?, buyer_id = ? WHERE id = ?').run(
            'sold',
            order.buyer_id,
            item.product_id,
          );
        }
        db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(order.buyer_id);
      }
    }
  }

  return res.status(200).json({ received: true });
});

app.use(express.json());

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch {
    if (!firebaseAuth) return res.status(401).json({ error: 'Invalid token' });
  }

  return firebaseAuth
    .verifyIdToken(token)
    .then((decoded) => {
      const firebaseUid = decoded.uid;
      const firebaseEmail = (decoded.email || '').toLowerCase().trim();
      const firebaseName = decoded.name || (firebaseEmail ? firebaseEmail.split('@')[0] : 'Utilizador');
      const firebaseAvatar = firebaseName.charAt(0).toUpperCase();

      let user = db.prepare('SELECT id FROM users WHERE id = ?').get(firebaseUid);
      if (!user && firebaseEmail) {
        user = db.prepare('SELECT id FROM users WHERE email = ?').get(firebaseEmail);
      }
      const localUserId = user ? user.id : firebaseUid;

      if (!user) {
        db.prepare(
          `INSERT INTO users
            (id,name,email,password_hash,avatar,email_verified,created_at)
            VALUES (?,?,?,?,?,?,?)`,
        ).run(
          firebaseUid,
          firebaseName,
          firebaseEmail || `${firebaseUid}@firebase.local`,
          'firebase_auth',
          firebaseAvatar,
          decoded.email_verified ? 1 : 0,
          new Date().toISOString(),
        );
      } else {
        db.prepare('UPDATE users SET name = ?, avatar = ?, email_verified = ? WHERE id = ?').run(
          firebaseName,
          firebaseAvatar,
          decoded.email_verified ? 1 : 0,
          localUserId,
        );
        if (firebaseEmail) {
          db.prepare('UPDATE users SET email = ? WHERE id = ?').run(firebaseEmail, localUserId);
        }
      }

      req.userId = localUserId;
      return next();
    })
    .catch(() => res.status(401).json({ error: 'Invalid token' }));
}

// Legacy auth endpoints kept for backward compatibility.
function createCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendMail({ to, subject, text, html }) {
  if (!mailer) throw new Error('SMTP not configured');
  await mailer.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

function mapPaymentMethod(row) {
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    isDefault: Boolean(row.is_default),
    brand: row.brand || undefined,
    last4: row.last4 || undefined,
    holderName: row.holder_name || undefined,
    expiresAt: row.expires_at || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
  };
}

function getPaymentMethods(userId) {
  const rows = db.prepare('SELECT * FROM payment_methods WHERE user_id = ?').all(userId);
  return rows.map(mapPaymentMethod);
}

function getPublicUser(userId) {
  const row = db.prepare('SELECT id,name,email,avatar,email_verified FROM users WHERE id = ?').get(userId);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatar: row.avatar,
    emailVerified: Boolean(row.email_verified),
    paymentMethods: getPaymentMethods(userId),
  };
}

function mapProduct(row) {
  const seller = getPublicUser(row.seller_id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    category: row.category,
    image: row.image,
    sellerId: row.seller_id,
    buyerId: row.buyer_id || undefined,
    status: row.status,
    createdAt: row.created_at,
    seller,
  };
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, smtpConfigured: Boolean(mailer) });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (!mailer) return res.status(500).json({ error: 'SMTP not configured on server' });

  const normalizedEmail = String(email).toLowerCase().trim();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (exists) return res.status(409).json({ error: 'Email already exists' });

  const userId = createId('u');
  const code = createCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  db.prepare(
    `INSERT INTO users
      (id,name,email,password_hash,avatar,email_verified,email_verify_token,email_verify_expires_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`,
  ).run(
    userId,
    String(name).trim(),
    normalizedEmail,
    bcrypt.hashSync(String(password), 10),
    String(name).trim().charAt(0).toUpperCase(),
    0,
    code,
    expiresAt,
    new Date().toISOString(),
  );

  try {
    await sendMail({
      to: normalizedEmail,
      subject: 'LOOT BOX - Verificação de email',
      text: `O teu código de verificação é: ${code}. Expira em 10 minutos.`,
      html: `<p>O teu código de verificação é: <b>${code}</b></p><p>Expira em 10 minutos.</p>`,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to send verification email' });
  }

  return res.json({ success: true, requiresVerification: true });
});

app.post('/api/auth/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Missing fields' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = db
    .prepare('SELECT id,email_verify_token,email_verify_expires_at,email_verified FROM users WHERE email = ?')
    .get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Email not found' });
  if (user.email_verified) return res.json({ success: true });
  if (!user.email_verify_token || String(code).trim() !== String(user.email_verify_token)) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }
  if (!user.email_verify_expires_at || Date.now() > new Date(user.email_verify_expires_at).getTime()) {
    return res.status(400).json({ error: 'Verification code expired' });
  }

  db.prepare('UPDATE users SET email_verified = 1, email_verify_token = NULL, email_verify_expires_at = NULL WHERE id = ?').run(user.id);
  return res.json({ success: true });
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  if (!mailer) return res.status(500).json({ error: 'SMTP not configured on server' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = db.prepare('SELECT id,email_verified FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Email not found' });
  if (user.email_verified) return res.json({ success: true });

  const code = createCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET email_verify_token = ?, email_verify_expires_at = ? WHERE id = ?').run(
    code,
    expiresAt,
    user.id,
  );

  try {
    await sendMail({
      to: normalizedEmail,
      subject: 'LOOT BOX - Novo código de verificação',
      text: `O teu novo código é: ${code}.`,
      html: `<p>O teu novo código é: <b>${code}</b></p>`,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to send verification email' });
  }
  return res.json({ success: true });
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  if (!mailer) return res.status(500).json({ error: 'SMTP not configured on server' });

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Email not found' });

  const code = createCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE id = ?').run(code, expiresAt, user.id);

  try {
    await sendMail({
      to: normalizedEmail,
      subject: 'LOOT BOX - Recuperação de password',
      text: `O teu código de recuperação é: ${code}.`,
      html: `<p>O teu código de recuperação é: <b>${code}</b></p>`,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to send reset email' });
  }

  return res.json({ success: true });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = db.prepare('SELECT id,reset_token,reset_expires_at FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Email not found' });
  if (!user.reset_token || String(code).trim() !== String(user.reset_token)) {
    return res.status(400).json({ error: 'Invalid reset code' });
  }
  if (!user.reset_expires_at || Date.now() > new Date(user.reset_expires_at).getTime()) {
    return res.status(400).json({ error: 'Reset code expired' });
  }

  db.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?',
  ).run(bcrypt.hashSync(String(newPassword), 10), user.id);
  return res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  const userRow = db
    .prepare('SELECT id,password_hash,email_verified FROM users WHERE email = ?')
    .get(String(email).toLowerCase());
  if (!userRow || !bcrypt.compareSync(String(password), userRow.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (!userRow.email_verified) {
    return res.status(403).json({ error: 'Email not verified' });
  }
  return res.json({ token: signToken(userRow.id), user: getPublicUser(userRow.id) });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = getPublicUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

app.get('/api/payment-methods', auth, (req, res) => res.json({ paymentMethods: getPaymentMethods(req.userId) }));

app.post('/api/payment-methods', auth, (req, res) => {
  const { type, label, brand, last4, holderName, expiresAt, phone, email } = req.body;
  if (!type || !label) return res.status(400).json({ error: 'Missing fields' });
  const hasDefault = db.prepare('SELECT id FROM payment_methods WHERE user_id = ? AND is_default = 1').get(req.userId);
  db.prepare(
    `INSERT INTO payment_methods
      (id,user_id,type,label,is_default,brand,last4,holder_name,expires_at,phone,email)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    createId('pm'),
    req.userId,
    type,
    label,
    hasDefault ? 0 : 1,
    brand || null,
    last4 || null,
    holderName || null,
    expiresAt || null,
    phone || null,
    email || null,
  );
  return res.json({ paymentMethods: getPaymentMethods(req.userId) });
});

app.patch('/api/payment-methods/:id/default', auth, (req, res) => {
  const method = db.prepare('SELECT id FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!method) return res.status(404).json({ error: 'Method not found' });
  db.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(req.userId);
  db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(req.params.id);
  return res.json({ paymentMethods: getPaymentMethods(req.userId) });
});

app.delete('/api/payment-methods/:id', auth, (req, res) => {
  const current = db.prepare('SELECT id,is_default FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!current) return res.status(404).json({ error: 'Method not found' });
  db.prepare('DELETE FROM payment_methods WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (current.is_default) {
    const fallback = db.prepare('SELECT id FROM payment_methods WHERE user_id = ? LIMIT 1').get(req.userId);
    if (fallback) db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(fallback.id);
  }
  return res.json({ paymentMethods: getPaymentMethods(req.userId) });
});

app.get('/api/products', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY datetime(created_at) DESC').all();
  res.json({ products: rows.map(mapProduct) });
});

app.post('/api/products', auth, (req, res) => {
  const { name, description, price, category, image } = req.body;
  if (!name || !description || !price || !category || !image) return res.status(400).json({ error: 'Missing fields' });
  const id = createId('p');
  db.prepare(
    `INSERT INTO products
      (id,name,description,price,category,image,seller_id,buyer_id,status,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
  ).run(id, String(name), String(description), Number(price), String(category), String(image), req.userId, null, 'available', new Date().toISOString());
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return res.status(201).json({ product: mapProduct(product) });
});

app.get('/api/favorites', auth, (req, res) => {
  const favorites = db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(req.userId).map((row) => row.product_id);
  res.json({ favorites });
});

app.post('/api/favorites/:productId/toggle', auth, (req, res) => {
  const existing = db.prepare('SELECT product_id FROM favorites WHERE user_id = ? AND product_id = ?').get(req.userId, req.params.productId);
  if (existing) db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.userId, req.params.productId);
  else db.prepare('INSERT INTO favorites (user_id,product_id) VALUES (?,?)').run(req.userId, req.params.productId);
  const favorites = db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(req.userId).map((row) => row.product_id);
  res.json({ favorites });
});

app.get('/api/cart', auth, (req, res) => {
  const cart = db.prepare('SELECT product_id as productId, quantity FROM cart_items WHERE user_id = ?').all(req.userId);
  res.json({ cart });
});

app.post('/api/cart', auth, (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId required' });
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product || product.status !== 'available') return res.status(400).json({ error: 'Product unavailable' });
  db.prepare(
    'INSERT INTO cart_items (user_id,product_id,quantity) VALUES (?,?,1) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=1',
  ).run(req.userId, productId);
  return res.json({ ok: true });
});

app.delete('/api/cart/:productId', auth, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.userId, req.params.productId);
  res.json({ ok: true });
});

app.post('/api/orders/checkout-session', auth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: 'Stripe not configured' });
  const { paymentMethodId, shippingAddress, note } = req.body;
  if (!paymentMethodId || !shippingAddress) return res.status(400).json({ error: 'Missing checkout fields' });

  const cartRows = db
    .prepare(
      `SELECT p.* FROM cart_items c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ? AND p.status = 'available' AND p.seller_id <> ?`,
    )
    .all(req.userId, req.userId);
  if (cartRows.length === 0) return res.status(400).json({ error: 'Cart is empty' });

  const subtotal = cartRows.reduce((sum, p) => sum + Number(p.price), 0);
  const serviceFee = subtotal * 0.04;
  const total = subtotal + serviceFee;
  const orderId = createId('ord');

  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders
      (id,buyer_id,subtotal,service_fee,total,payment_method_id,shipping_address,note,status,stripe_session_id,stripe_payment_intent,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(orderId, req.userId, subtotal, serviceFee, total, paymentMethodId, shippingAddress, note || null, 'processing', null, null, new Date().toISOString());
    const ins = db.prepare('INSERT INTO order_items (id,order_id,product_id,price) VALUES (?,?,?,?)');
    for (const product of cartRows) ins.run(createId('oi'), orderId, product.id, Number(product.price));
  });
  transaction();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      ...cartRows.map((p) => ({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(Number(p.price) * 100),
          product_data: { name: p.name, description: p.description.slice(0, 200), images: p.image ? [p.image] : [] },
        },
      })),
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(serviceFee * 100),
          product_data: { name: 'Taxa de serviço LOOT BOX' },
        },
      },
    ],
    metadata: { orderId },
    success_url: `${CLIENT_URL}/?checkout=success&order_id=${orderId}`,
    cancel_url: `${CLIENT_URL}/?checkout=cancel&order_id=${orderId}`,
  });

  db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, orderId);
  return res.json({ url: session.url, orderId });
});

app.get('/api/orders/my', auth, (req, res) => {
  const orderRows = db.prepare('SELECT * FROM orders WHERE buyer_id = ? ORDER BY datetime(created_at) DESC').all(req.userId);
  const orders = orderRows.map((order) => {
    const items = db
      .prepare(
        `SELECT oi.product_id, oi.price, p.name, p.image, p.category
         FROM order_items oi JOIN products p ON p.id = oi.product_id
         WHERE oi.order_id = ?`,
      )
      .all(order.id);
    return {
      id: order.id,
      itemIds: items.map((i) => i.product_id),
      items,
      buyerId: order.buyer_id,
      subtotal: order.subtotal,
      serviceFee: order.service_fee,
      total: order.total,
      paymentMethodId: order.payment_method_id,
      shippingAddress: order.shipping_address,
      note: order.note || undefined,
      status: order.status,
      createdAt: order.created_at,
    };
  });
  res.json({ orders });
});

app.get('/api/conversations', auth, (req, res) => {
  const convRows = db
    .prepare(
      `SELECT c.* FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = ?
       ORDER BY datetime(c.updated_at) DESC`,
    )
    .all(req.userId);
  const conversations = convRows.map((conv) => {
    const participants = db.prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ?').all(conv.id).map((row) => row.user_id);
    const messages = db
      .prepare('SELECT id,sender_id,text,created_at FROM messages WHERE conversation_id = ? ORDER BY datetime(created_at)')
      .all(conv.id)
      .map((m) => ({ id: m.id, senderId: m.sender_id, text: m.text, createdAt: m.created_at }));
    return { id: conv.id, participantIds: participants, productId: conv.product_id || undefined, messages, updatedAt: conv.updated_at };
  });
  res.json({ conversations });
});

app.post('/api/conversations/start', auth, (req, res) => {
  const { otherUserId, productId } = req.body;
  if (!otherUserId || otherUserId === req.userId) return res.status(400).json({ error: 'Invalid user' });
  const existing = db
    .prepare(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
       WHERE cp1.user_id = ? AND cp2.user_id = ? AND IFNULL(c.product_id,'') = IFNULL(?, '')`,
    )
    .get(req.userId, otherUserId, productId || null);
  if (existing) return res.json({ conversationId: existing.id });
  const id = createId('conv');
  db.prepare('INSERT INTO conversations (id,product_id,updated_at) VALUES (?,?,?)').run(id, productId || null, new Date().toISOString());
  db.prepare('INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?)').run(id, req.userId);
  db.prepare('INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?)').run(id, otherUserId);
  res.json({ conversationId: id });
});

app.post('/api/conversations/:id/messages', auth, (req, res) => {
  const { text } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Empty message' });
  const isParticipant = db.prepare('SELECT 1 as ok FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('INSERT INTO messages (id,conversation_id,sender_id,text,created_at) VALUES (?,?,?,?,?)').run(
    createId('msg'),
    req.params.id,
    req.userId,
    String(text).trim(),
    new Date().toISOString(),
  );
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`API running on http://127.0.0.1:${PORT}`);
});
