const userService = require('../services/userService');
const authService = require('../services/authService');
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
 * PUT /users/me — update the authenticated user's email and/or password.
 * The password is hashed here before it ever reaches the service layer.
 */
async function update(req, res) {
  const { email, password } = req.body;
  if (!email && !password) {
    return res.status(400).json({ error: 'Provide an email and/or password to update' });
  }
  let passwordHash;
  if (password) {
    passwordHash = await authService.hashPassword(password);
  }
  const user = await userService.update(req.userId, { email, passwordHash });
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
