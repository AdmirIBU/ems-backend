import jwt from 'jsonwebtoken'

export function signToken(userId: string) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || '', { expiresIn: '1h' })
}
