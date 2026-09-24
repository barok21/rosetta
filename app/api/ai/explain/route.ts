import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { log } = await req.json();

    const prompt = `You are an expert DevOps engineer and backend developer. Please explain this log entry and what might have caused it. If it's an error, suggest potential fixes. Keep it concise but helpful. Format your response in Markdown.

Log details:
${JSON.stringify(log, null, 2)}
`;

    const response = await fetch('http://127.0.0.1:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama3.1',
        prompt: prompt,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    // Return the stream directly to the client
    // Ollama streams JSON lines, e.g., {"model":"llama3.1","response":"The","done":false}
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('AI Explain Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to explain log' }, { status: 500 });
  }
}
