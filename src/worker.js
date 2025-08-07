import { gptAPICall } from "./middleware/gptAPI";
import { createDoc, failedDoc, completeDoc, getRecord } from "./model/db";


export default {
    async fetch(request, env, ctx) {
        // Define CORS header for access from Svelte app worker
        const corsHeaders = {
        'Access-Control-Allow-Origin': 'https://worker-svelte.alireza78-bk.workers.dev',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        };

        // Handle preflight request (for CORS)
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: corsHeaders
            });
        }

        if (request.method === "GET") {
            const url = new URL(request.url);
            const jobId = url.searchParams.get('jobId');

            if (!jobId) {
                return new Response('Missing job ID in request', {
                    status: 400,
                    headers: corsHeaders
                });
            }

            // Call databse to find the jobid record
            const serverResponse = await getRecord(jobId, env);
            if (!serverResponse.ok) {
                return new Response(serverResponse.error, {
                    status: 500,
                    headers: corsHeaders
                });
            }

            const { status, itinerary } = serverResponse.data;

            return new Response(JSON.stringify({ status, itinerary }), {
                    status: 200,
                    headers: {
                    'Content-Type': 'application/json',
                    ...corsHeaders
                    }
                });    
        }

        // Check the type of method
        if (request.method !== 'POST') {
            return new Response('Method Not Allowed!', {
                status: 405,
                headers: {
                    'Allow': 'POST',
                    'Content-Type': 'text/plain'
                }
            });
        }

        // Check the content type for being json
        const contentType = request.headers.get('Content-Type');
        if (!contentType || !contentType.includes('application/json')) {
            return new Response('Content type should be application/json', {
                status: 400,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        }

        let dataJson;
        try {
            dataJson = await request.json();
        } catch {
            return new Response('Request body should be json', {
                status: 400,
                headers: {
                    'Content-Type': 'text/plain'
                }
            });
        }

        const { destination, durationDays } = dataJson;
        if (!destination || !durationDays){
            return new Response('Missin destination or duration fields', 
                {
                    status: 400,
                    headers: {
                        'Content-Type': 'text/plain'
                    }
                }
            );
        }

        const jobId = crypto.randomUUID();
        // Create instant response with 202 status with the jobId
        const response = new Response(
            JSON.stringify({
                jobid: jobId,
                status: "Accepted",
                message: "Request received, processing",
            }),
            {
                status: 202,
                headers: {
                "Content-Type": "application/json",
                },
            }
        );

        // Keep running after sending response
        ctx.waitUntil(
            (async () => {
                // Create document in background
                const created = await createDoc(jobId, destination, durationDays, env);
                if (!created.ok) {
                    console.error("Failed to create document: ", created.error);
                    // Optionally: record failure somewhere or retry
                    return;
                }

                // Call GPT API in background
                const gptResponse = await gptAPICall(destination, durationDays, env);
                if (!gptResponse.ok) {
                    // Handle GPT failure: mark job as failed in DB
                    const failed = await failedDoc(jobId, gptResponse.error, env);
                    if (!failed.ok) {
                        console.error("Failed to change database document status: ", failed.error);
                    }
                    return;
                }

                // Mark job as completed with GPT data
                const completed = await completeDoc(jobId, gptResponse.data, env);
                if (!completed.ok) {
                    console.error("Failed to complete the database document: ", completed.error);
                }
        })()
        );

        return response;
    }
}