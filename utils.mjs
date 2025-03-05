export function generateRandomBytes(n) {
  // Validate input
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('Number of bytes must be a positive integer');
  }

  // Create an array to store the random bytes
  const randomBytes = new Array(n);

  // Fill the array with random values (0-255)
  for (let i = 0; i < n; i++) {
    randomBytes[i] = Math.floor(Math.random() * 256);
  }

  // Convert the bytes to hex string
  return randomBytes
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}
