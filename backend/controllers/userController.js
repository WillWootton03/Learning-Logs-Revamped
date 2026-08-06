const userService = require('../services/userService');
const authService = require('../services/authService');
const userRepository = require('../repositories/userRepository');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * GET /users/me — return the currently authenticated user (from req.userId,
 * set by the authenticate middleware). This is the only user endpoint; a user
 * can only ever see or act on their own account.
 */
async function me(req, res) {
  const user = await userService.getById(req.userId);
  return res.status(200).json(user);
}

/**
 * PUT /users/me — update the authenticated user's name, email and/or
 * password. Changing the password requires the current one; it is hashed here
 * before it ever reaches the service layer.
 */
async function update(req, res) {
  const { name, email, password, currentPassword } = req.body;
  if (name === undefined && !email && !password) {
    return res.status(400).json({ error: 'Provide a name, email, and/or password to update' });
  }
  let passwordHash;
  if (password) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Current password is required to change your password' });
    }
    const user = await userRepository.findById(req.userId);
    if (!user || !user.password_hash) {
      return res.status(400).json({ error: 'Password changes require an existing password on the account' });
    }
    const valid = await authService.verifyPassword(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    passwordHash = await authService.hashPassword(password);
  }
  const user = await userService.update(req.userId, {
    fullName: name,
    email,
    passwordHash,
  });
  return res.status(200).json(user);
}

/**
 * DELETE /users/me — delete the authenticated user's account.
 */
async function remove(req, res) {
  const result = await userService.remove(req.userId);
  return res.status(200).json(result);
}

module.exports = {
  me: asyncHandler(me),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
