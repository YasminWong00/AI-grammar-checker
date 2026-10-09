import { GoogleGenAI } from "@google/genai"
import { NextResponse } from "next/server"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
})

function isBusyError(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return false
  }

  const status = error.status
  return status === 429 || status === 503
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function asPlainText(value: unknown) {
  if (typeof value !== "string") {
    return ""
  }

  return value
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/(^|[\s(])\*(.*?)\*(?=[\s).,!?]|$)/g, "$1$2")
    .replace(/^#{1,6}\s+/gm, "")
    .trim()
}

function parseGrammarResult(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")

  const data = JSON.parse(cleaned) as {
    corrected?: unknown
    issues?: unknown
    score?: unknown
    note?: unknown
  }

  const issues = Array.isArray(data.issues)
    ? data.issues.flatMap((issue) => {
        if (typeof issue !== "object" || issue === null) {
          return []
        }

        const title = asPlainText(
          "title" in issue ? issue.title : ""
        )
        const detail = asPlainText(
          "detail" in issue ? issue.detail : ""
        )

        if (!title && !detail) {
          return []
        }

        return [{ title: title || "Issue", detail }]
      })
    : []

  const score = Number(data.score)

  if (!Number.isFinite(score)) {
    throw new Error("Invalid score")
  }

  const corrected = asPlainText(data.corrected)

  if (!corrected) {
    throw new Error("Missing corrected sentence")
  }

  return {
    corrected,
    issues,
    score: Math.max(0, Math.min(100, Math.round(score))),
    note: asPlainText(data.note),
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()

    const text = body.text

    if (!text || !text.trim()) {
      return NextResponse.json(
        {
          error: "Text is required",
        },
        {
          status: 400,
        }
      )
    }

    let response
    let lastError: unknown

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: `
You are an English grammar checker.

Check the student's sentence.

Write every field in plain text. Do not use markdown, asterisks, or bold.

Student sentence:
"${text}"
          `,
          config: {
            responseMimeType: "application/json",
            responseJsonSchema: {
              type: "object",
              properties: {
                corrected: {
                  type: "string",
                  description: "The corrected sentence only.",
                },
                issues: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: {
                        type: "string",
                        description: "Short name of the problem.",
                      },
                      detail: {
                        type: "string",
                        description: "Plain explanation of that problem.",
                      },
                    },
                    required: ["title", "detail"],
                  },
                },
                score: {
                  type: "integer",
                  description: "Grammar score from 0 to 100.",
                },
                note: {
                  type: "string",
                  description: "One short sentence about the score.",
                },
              },
              required: ["corrected", "issues", "score", "note"],
            },
          },
        })
        break
      } catch (error) {
        lastError = error

        if (!isBusyError(error) || attempt === 2) {
          throw error
        }

        await wait(1000 * (attempt + 1))
      }
    }

    if (!response?.text) {
      throw lastError ?? new Error("Empty Gemini response")
    }

    return NextResponse.json({
      result: parseGrammarResult(response.text),
    })
  } catch (error) {
    console.error("Gemini error:", error)

    const busy = isBusyError(error)

    return NextResponse.json(
      {
        error: busy
          ? "Gemini is busy right now. Please try again in a moment."
          : "Failed to check grammar",
      },
      {
        status: busy ? 503 : 500,
      }
    )
  }
}
