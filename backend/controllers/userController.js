const userService = require('../services/userService');
const authService = require('../services/authService');
const asyncHandler = require('../middleware/asyncHandler');

/**
 * GET /users/me — return the currently authenticated user (from req.userId,
 * set by the authenticate middleware).
 */
async function me(req, res) {
  const user = await userService.getById(req.userId);
  return res.status(200).json(user);
}

/**
 * GET /users/:id — return a single user by id.
 */
async function getById(req, res) {
  const user = await userService.getById(req.params.id);
  return res.status(200).json(user);
}

/**
 * PUT /users/:id — update a user's email and/or password.
 * The password is hashed here before it ever reaches the service layer.
 */
async function update(req, res) {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  let passwordHash;
  if (password) {
    passwordHash = await authService.hashPassword(password);
  }
  const user = await userService.update(req.params.id, { email, passwordHash });
  return res.status(200).json(user);
}

/**
 * DELETE /users/:id — delete a user by id.
 */
async function remove(req, res) {
  const result = await userService.remove(req.params.id);
  return res.status(200).json(result);
}

module.exports = {
  me: asyncHandler(me),
  getById: asyncHandler(getById),
  update: asyncHandler(update),
  remove: asyncHandler(remove),
};
