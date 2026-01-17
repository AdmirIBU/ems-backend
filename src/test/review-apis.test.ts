import request from 'supertest'

import { createApp } from '../app'
import { signToken } from './helpers'

import User from '../models/User'
import Exam from '../models/Exam'
import ExamAttempt from '../models/ExamAttempt'

describe('Review request fields in GET endpoints', () => {
  it('GET /api/grades includes review request/response fields for the student', async () => {
    const student = await User.create({ name: 'S', email: 'grades@example.com', password: 'password123', role: 'student' })
    const otherStudent = await User.create({ name: 'O', email: 'othergrades@example.com', password: 'password123', role: 'student' })

    const exam1 = await Exam.create({ title: 'Exam A', date: new Date('2025-01-01T10:00:00.000Z') })
    const exam2 = await Exam.create({ title: 'Exam B', date: new Date('2025-02-01T10:00:00.000Z') })
    const exam3 = await Exam.create({ title: 'Exam Draft', date: new Date('2025-02-15T10:00:00.000Z') })

    await ExamAttempt.create({
      exam: exam1._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date('2025-01-01T11:00:00.000Z'),
      answers: [],
      pointsAwarded: 8,
      pointsTotal: 10,
      reviewRequested: true,
      reviewRequestedAt: new Date('2025-01-02T09:00:00.000Z'),
      reviewRequestMessage: 'Please check my answer',
      reviewAppointmentAt: new Date('2025-01-03T14:30:00.000Z'),
      reviewResponseMessage: 'Ok, see you then',
      reviewRespondedAt: new Date('2025-01-02T10:00:00.000Z'),
    })

    await ExamAttempt.create({
      exam: exam2._id,
      student: student._id,
      startedAt: new Date(),
      submittedAt: new Date('2025-02-01T11:00:00.000Z'),
      answers: [],
      pointsAwarded: 6,
      pointsTotal: 10,
      reviewRequested: false,
    })

    // Not returned: not submitted
    await ExamAttempt.create({
      exam: exam3._id,
      student: student._id,
      startedAt: new Date(),
      answers: [],
    })

    // Not returned: different student
    await ExamAttempt.create({
      exam: exam1._id,
      student: otherStudent._id,
      startedAt: new Date(),
      submittedAt: new Date(),
      answers: [],
    })

    const token = signToken(String(student._id))
    const res = await request(createApp()).get('/api/grades').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body)).toBe(true)

    expect(res.body.length).toBe(2)

    const rowWithRequest = res.body.find((r: any) => r.exam?.title === 'Exam A')
    expect(rowWithRequest).toBeTruthy()
    expect(rowWithRequest.reviewRequested).toBe(true)
    expect(rowWithRequest.reviewRequestedAt).toBeTruthy()
    expect(rowWithRequest.reviewAppointmentAt).toBeTruthy()
    expect(rowWithRequest.reviewResponseMessage).toBe('Ok, see you then')
    expect(rowWithRequest.reviewRespondedAt).toBeTruthy()

    const rowNoRequest = res.body.find((r: any) => r.exam?.title === 'Exam B')
    expect(rowNoRequest).toBeTruthy()
    expect(rowNoRequest.reviewRequested).toBe(false)
  })

  it('GET /api/exams/:id/results includes review request status for professors', async () => {
    const professor = await User.create({ name: 'P', email: 'profresults@example.com', password: 'password123', role: 'professor' })
    const s1 = await User.create({ name: 'S1', email: 's1@results.com', password: 'password123', role: 'student' })
    const s2 = await User.create({ name: 'S2', email: 's2@results.com', password: 'password123', role: 'student' })

    const exam = await Exam.create({ title: 'Exam Results', date: new Date('2025-03-01T10:00:00.000Z') })

    await ExamAttempt.create({
      exam: exam._id,
      student: s1._id,
      startedAt: new Date(),
      submittedAt: new Date('2025-03-01T11:00:00.000Z'),
      answers: [],
      pointsAwarded: 9,
      pointsTotal: 10,
      reviewRequested: true,
      reviewRequestedAt: new Date('2025-03-02T09:00:00.000Z'),
      reviewAppointmentAt: new Date('2025-03-03T15:00:00.000Z'),
      reviewRespondedAt: new Date('2025-03-02T10:00:00.000Z'),
    })

    await ExamAttempt.create({
      exam: exam._id,
      student: s2._id,
      startedAt: new Date(),
      submittedAt: new Date('2025-03-01T11:05:00.000Z'),
      answers: [],
      pointsAwarded: 7,
      pointsTotal: 10,
      reviewRequested: false,
    })

    const token = signToken(String(professor._id))
    const res = await request(createApp())
      .get(`/api/exams/${exam._id}/results`)
      .set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(200)
    expect(res.body.exam?.title).toBe('Exam Results')
    expect(Array.isArray(res.body.results)).toBe(true)

    const rows = res.body.results
    expect(rows.length).toBe(2)

    const requested = rows.find((r: any) => r.reviewRequested === true)
    expect(requested).toBeTruthy()
    expect(requested.reviewRequestedAt).toBeTruthy()
    expect(requested.reviewAppointmentAt).toBeTruthy()
    expect(requested.reviewRespondedAt).toBeTruthy()

    const notRequested = rows.find((r: any) => r.reviewRequested === false)
    expect(notRequested).toBeTruthy()
  })
})
