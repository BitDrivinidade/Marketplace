const originalDecodeURIComponent = global.decodeURIComponent;

global.decodeURIComponent = (value) => {
  try {
    return originalDecodeURIComponent(value);
  } catch {
    return value;
  }
};
