export async function gptAPICall(destination, durationDays, env) {
    const prompt = `Create a detailed travel itinerary for ${durationDays} 
        days in ${destination}. Format it as strict JSON like this:
        {
        "itinerary": [
            {
            "day": 1,
            "theme": "Historical Paris",
            "activities": [
                {
                "time": "Morning",
                "description": "Visit the Louvre Museum. Pre-book tickets to avoid queues.",
                "location": "Louvre Museum"
                },
                {
                "time": "Afternoon",
                "description": "Explore the Notre-Dame Cathedral area and walk along the Seine.",
                "location": "Île de la Cité"
                },
                {
                "time": "Evening",
                "description": "Dinner in the Latin Quarter.",
                "location": "Latin Quarter"
                }
            ]
            }
            // additional days will follow in the same format
        ]
        }
        `;
    try{
        const gptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                        model: "gpt-4o",
                        messages: [{role: "user", content: prompt}],
                        temperature: 0.7
                })
            }); 
        if (!gptResponse.ok) {
            return { ok: false, error: `GPT API HTTP error: ${gptResponse.status}` };
        }
        let response;
        try {
            response = await gptResponse.json();
        } catch {
            return { ok: false, error: 'GPT response not in json form'}
        }
        
        let rawContent = response.choices?.[0]?.message?.content?.trim();
        if (!rawContent) {
            return { ok: false, error: 'No content from GPT' };
        }
        // Remove Markdown wrapping
        rawContent = rawContent.replace(/^\s*```(?:json)?/, '').replace(/```\s*$/, '').trim();
        let parsed;
        try {
            parsed = JSON.parse(rawContent);
        } catch {
            return { ok: false, error: 'GPT parsed output not valid JSON' };
        }
        return { ok: true, data: parsed };
    } catch {
        return { ok: false, error: 'GPT API call failed' };
    }
}