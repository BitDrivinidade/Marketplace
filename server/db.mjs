import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(path.join(dataDir, 'lootbox.db'));
db.pragma('foreign_keys = ON');

function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      avatar TEXT,
      email_verified INTEGER NOT NULL DEFAULT 1,
      email_verify_token TEXT,
      email_verify_expires_at TEXT,
      reset_token TEXT,
      reset_expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      brand TEXT,
      last4 TEXT,
      holder_name TEXT,
      expires_at TEXT,
      phone TEXT,
      email TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      image TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      buyer_id TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL,
      FOREIGN KEY(seller_id) REFERENCES users(id),
      FOREIGN KEY(buyer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      PRIMARY KEY(user_id, product_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(user_id, product_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      subtotal REAL NOT NULL,
      service_fee REAL NOT NULL,
      total REAL NOT NULL,
      payment_method_id TEXT,
      shipping_address TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL,
      stripe_session_id TEXT,
      stripe_payment_intent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(buyer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY(conversation_id, user_id),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id)
    );
  `);

  const userColumns = db.prepare(`PRAGMA table_info(users)`).all();
  const names = new Set(userColumns.map((c) => c.name));
  if (!names.has('email_verified')) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!names.has('email_verify_token')) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verify_token TEXT;`);
  }
  if (!names.has('email_verify_expires_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verify_expires_at TEXT;`);
  }
  if (!names.has('reset_token')) {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT;`);
  }
  if (!names.has('reset_expires_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN reset_expires_at TEXT;`);
  }
}

function seed() {
  const count = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  if (count > 0) return;

  const now = new Date().toISOString();
  const userA = {
    id: 'u1',
    name: 'Bit Drivinidade',
    email: 'bitdrivinidade@gmail.com',
    avatar: 'B',
    passwordHash: bcrypt.hashSync('123456', 10),
  };
  const userB = {
    id: 'u2',
    name: 'LOL',
    email: 'celio8625@gmail.com',
    avatar: 'L',
    passwordHash: bcrypt.hashSync('123456', 10),
  };

  const insertUser = db.prepare(
    'INSERT INTO users (id,name,email,password_hash,avatar,email_verified,created_at) VALUES (@id,@name,@email,@passwordHash,@avatar,@emailVerified,@createdAt)',
  );
  insertUser.run({ ...userA, emailVerified: 1, createdAt: now });
  insertUser.run({ ...userB, emailVerified: 1, createdAt: now });

  db.prepare(
    `INSERT INTO payment_methods
      (id,user_id,type,label,is_default,brand,last4,holder_name,expires_at,phone,email)
      VALUES (@id,@userId,@type,@label,@isDefault,@brand,@last4,@holderName,@expiresAt,@phone,@email)`,
  ).run({
    id: 'pm_seed_visa',
    userId: userA.id,
    type: 'card',
    label: 'Visa final 4242',
    isDefault: 1,
    brand: 'Visa',
    last4: '4242',
    holderName: null,
    expiresAt: null,
    phone: null,
    email: null,
  });

  const insertProduct = db.prepare(
    `INSERT INTO products
      (id,name,description,price,category,image,seller_id,buyer_id,status,created_at)
      VALUES (@id,@name,@description,@price,@category,@image,@sellerId,@buyerId,@status,@createdAt)`,
  );
  insertProduct.run({
    id: 'seed1',
    name: 'PlayStation 5 + 2 comandos',
    description: 'Consola em excelente estado, com caixa e garantia.',
    price: 429.99,
    category: 'Eletrónica',
    image: 'https://images.unsplash.com/photo-1606144042614-b2417e99c4e3?w=800&h=800&fit=crop',
    sellerId: userA.id,
    buyerId: null,
    status: 'available',
    createdAt: now,
  });
  insertProduct.run({
    id: 'seed2',
    name: 'Bicicleta de estrada',
    description: 'Muito leve, ideal para treinos e passeios.',
    price: 320,
    category: 'Desporto',
    image: 'https://images.unsplash.com/photo-1511994298241-608e28f14fde?w=800&h=800&fit=crop',
    sellerId: userA.id,
    buyerId: null,
    status: 'available',
    createdAt: now,
  });
}

export function initDb() {
  createSchema();
  seed();
}

export function createId(prefix) {
  return uid(prefix);
}
