import { getAccessToken } from "./accessToken";


export async function createDoc(jobId, destination, durationDays, env) {
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/itineraries?documentId=${jobId}`;

  const token = await getAccessToken(env);

  const response = await fetch(firestoreUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        status: { stringValue: "processing" },
        destination: { stringValue: destination },
        durationDays: { integerValue: durationDays },
        createdAt: { timestampValue: new Date().toISOString() },
        completedAt: { nullValue: null },
        itinerary: {
          arrayValue: {
            values: []
          }
        },
        error: { nullValue: null }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    return { ok: false, error: errorText, status: response.status };
  }
  return { ok: true, message: "Document created successfully" };
}


export async function failedDoc(jobId, errorMessage, env) {
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/itineraries/${jobId}?updateMask.fieldPaths=status&updateMask.fieldPaths=completedAt&updateMask.fieldPaths=error`;
    const token = await getAccessToken(env);

    // Create document (also creates the collection if it doesn't exist)
    const response = await fetch(firestoreUrl, {
    method: "PATCH",
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        fields: {
        status: { stringValue: "failed" },
        completedAt: { timestampValue: new Date().toISOString() },
        error: { stringValue: errorMessage }
        }
    })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText, status: response.status };
    }
    return {ok: true, message: "Document status changed to failed"}
};


// Helper function to transform JavaScript objects to Firestore format
function transformToFirestoreFormat(obj) {
  if (obj === null || obj === undefined) {
    return { nullValue: null };
  }
  
  if (typeof obj === 'string') {
    return { stringValue: obj };
  }
  
  if (typeof obj === 'number') {
    return Number.isInteger(obj) ? { integerValue: obj.toString() } : { doubleValue: obj };
  }
  
  if (typeof obj === 'boolean') {
    return { booleanValue: obj };
  }
  
  if (Array.isArray(obj)) {
    return {
      arrayValue: {
        values: obj.map(item => transformToFirestoreFormat(item))
      }
    };
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const fields = {};
    for (const [key, value] of Object.entries(obj)) {
      fields[key] = transformToFirestoreFormat(value);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(obj) };
}


export async function completeDoc(jobId, gptResponse, env) {
    const transformedItinerary = transformToFirestoreFormat(gptResponse.itinerary);
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/itineraries/${jobId}?updateMask.fieldPaths=status&updateMask.fieldPaths=completedAt&updateMask.fieldPaths=itinerary`;
    const token = await getAccessToken(env);

    // Create document (also creates the collection if it doesn't exist)
    const response = await fetch(firestoreUrl, {
    method: "PATCH",
    headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        fields: {
        status: { stringValue: "completed" },
        completedAt: { timestampValue: new Date().toISOString() },
        itinerary: transformedItinerary,
        }
    })
    });
    if (!response.ok) {
        const errorText = await response.text();
        return { ok: false, error: errorText, status: response.status };
    }
    return {ok: true, message: "Document completed successfully"};
}


export async function getRecord(jobId, env) {
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIRESTORE_PROJECT_ID}/databases/(default)/documents/itineraries/${jobId}`;
  const token = await getAccessToken(env);
  
  const response = await fetch(firestoreUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'  // Good practice to include this
    }
  });

  if (response.status === 404) {
    return { ok: false, error: 'Document not found' };
  }

  if (!response.ok) {
    const error = await response.text();
    return { ok: false, error: `Error fetching document: ${error}` };
  }

  let responseBody;
  try {
    responseBody = await response.json();
  } catch {
    return { ok: false, error: 'DB response not in valid json'}
  }
  
  const fields = responseBody.fields;
  if (!fields) {
    return { ok: false, error: 'Invalid document structure' };
  }

  // Transform the entire document using your transformFirestoreDocument function
  const transformedData = transformFirestoreDocument({ fields });

  return { ok: true, data: transformedData };
}


// Helper function to transform Firestore document format to regular JSON
function transformFirestoreDocument(firestoreDoc) {
  if (!firestoreDoc.fields) {
    return {};
  }
  
  const result = {};
  for (const [key, value] of Object.entries(firestoreDoc.fields)) {
    result[key] = parseFirestoreValue(value);
  }
  return result;
}


// Parse Firestore value types to JavaScript types
function parseFirestoreValue(value) {
  if (value.stringValue !== undefined) {
    return value.stringValue;
  }
  if (value.integerValue !== undefined) {
    return parseInt(value.integerValue);
  }
  if (value.doubleValue !== undefined) {
    return parseFloat(value.doubleValue);
  }
  if (value.booleanValue !== undefined) {
    return value.booleanValue;
  }
  if (value.nullValue !== undefined) {
    return null;
  }
  if (value.arrayValue !== undefined) {
    return value.arrayValue.values?.map(v => parseFirestoreValue(v)) || [];
  }
  if (value.mapValue !== undefined) {
    const obj = {};
    if (value.mapValue.fields) {
      for (const [k, v] of Object.entries(value.mapValue.fields)) {
        obj[k] = parseFirestoreValue(v);
      }
    }
    return obj;
  }
  if (value.timestampValue !== undefined) {
    return new Date(value.timestampValue);
  }
  
  return value;
}