"use client"

import { useState } from "react"

type GrammarResult = {
  corrected: string
  issues: { title: string; detail: string }[]
  score: number
  note: string
}

export default function Home() {
  const [text, setText] = useState("")
  const [result, setResult] = useState<GrammarResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function checkGrammar() {
    if (!text.trim()) {
      setError("Please enter a sentence.")
      return
    }

    setLoading(true)
    setError("")
    setResult(null)

    try {
      const response = await fetch("/api/check-grammar", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(
          data.error || "Something went wrong"
        )
      }

      setResult(data.result)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to check grammar"
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 px-6 py-16 text-gray-900">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-4xl font-bold">
          AI Grammar Checker
        </h1>

        <p className="mt-3 text-gray-600">
          Enter a sentence and let Gemini check it.
        </p>

        <textarea
          value={text}
          onChange={(event) =>
            setText(event.target.value)
          }
          placeholder="Example: She go to school everyday."
          className="mt-8 min-h-40 w-full rounded-xl border border-gray-300 bg-white p-4 outline-none focus:border-black"
        />

        <button
          onClick={checkGrammar}
          disabled={loading}
          className="mt-4 rounded-lg bg-black px-6 py-3 text-white disabled:opacity-50"
        >
          {loading
            ? "Checking..."
            : "Check Grammar"}
        </button>

        {error && (
          <div className="mt-6 rounded-lg bg-red-50 p-4 text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-8 rounded-xl border bg-white p-6">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-semibold">
                AI Result
              </h2>
              <p className="rounded-full bg-gray-100 px-4 py-2 text-sm font-semibold">
                {result.score}/100
              </p>
            </div>

            <h3 className="mt-6 text-sm font-medium text-gray-500">
              Corrected sentence
            </h3>
            <p className="mt-2 text-lg">
              {result.corrected}
            </p>

            <h3 className="mt-6 text-sm font-medium text-gray-500">
              What was wrong
            </h3>
            {result.issues.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {result.issues.map((issue, index) => (
                  <li
                    key={`${issue.title}-${index}`}
                    className="rounded-lg bg-gray-50 p-4"
                  >
                    <p className="font-semibold">
                      {issue.title}
                    </p>
                    {issue.detail && (
                      <p className="mt-1 text-gray-700">
                        {issue.detail}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-gray-700">
                No grammar issues found.
              </p>
            )}

            {result.note && (
              <p className="mt-6 text-sm text-gray-600">
                {result.note}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
