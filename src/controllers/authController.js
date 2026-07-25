import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
})

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string(),
})

const normalizedRegisterSchema = registerSchema.extend({
  name: z.string().trim().min(2),
  email: z.string().trim().toLowerCase().email(),
})

function buildAuthResponse(user) {
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' })

  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      daily_rate: Number(user.daily_rate ?? 0),
    },
  }
}

export async function register(req, res) {
  const result = normalizedRegisterSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const { name, email, password } = result.data

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    return res.status(400).json({ error: 'E-mail já cadastrado' })
  }

  const password_hash = await bcrypt.hash(password, 10)

  const user = await prisma.user.create({
    data: { name, email, password_hash },
    select: { id: true, name: true, email: true, daily_rate: true },
  })

  return res.status(201).json(buildAuthResponse(user))
}

export async function login(req, res) {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    return res.status(400).json({ error: result.error.flatten().fieldErrors })
  }

  const { email, password } = result.data

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return res.status(401).json({ error: 'Credenciais inválidas' })
  }

  const valid = await bcrypt.compare(password, user.password_hash)
  if (!valid) {
    return res.status(401).json({ error: 'Credenciais inválidas' })
  }

  return res.json(buildAuthResponse(user))
}
