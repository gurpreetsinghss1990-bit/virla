import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-user-id',
}

function decodeJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const decoded = atob(payloadBase64);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

function getRequestUserId(req: Request): string | null {
  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const payload = decodeJwtPayload(token);
    if (payload && payload.sub) return payload.sub;
  }
  return req.headers.get('x-user-id') || null;
}

function compareNames(accountName: string, idName: string): { matches: boolean; confidence: number } {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  const cleanAccount = clean(accountName);
  const cleanId = clean(idName);
  
  if (cleanAccount === cleanId) {
    return { matches: true, confidence: 100 };
  }
  
  const accountTokens = cleanAccount.split(" ").filter(t => t.length > 0);
  const idTokens = cleanId.split(" ").filter(t => t.length > 0);
  
  if (accountTokens.length === 0 || idTokens.length === 0) {
    return { matches: false, confidence: 0 };
  }
  
  let matchCount = 0;
  for (const t of accountTokens) {
    if (idTokens.includes(t)) {
      matchCount++;
    }
  }
  
  const ratio = matchCount / Math.max(accountTokens.length, idTokens.length);
  const matches = ratio >= 0.65; // At least 65% token similarity
  return { matches, confidence: Math.round(ratio * 100) };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const userId = getRequestUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { document_id } = await req.json();
    if (!document_id) {
      return new Response(JSON.stringify({ error: 'Missing document_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the document record
    const { data: doc, error: docError } = await supabase
      .from('trainer_verification_documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !doc) {
      return new Response(JSON.stringify({ error: 'Document record not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify ownership or admin
    // In our client, the trainer applications id or trainer_id matches the user's ID
    const { data: isAdminRow } = await supabase.rpc('is_admin', { user_id: userId });
    const isAdmin = !!isAdminRow;

    if (doc.trainer_id !== userId && !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch document from private storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('trainer-verification')
      .download(doc.storage_path);

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to download document from storage' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // Fetch trainer application to get the account name
    // The trainer application table references owner/phone, let's find the application by trainer_id
    const { data: app, error: appError } = await supabase
      .from('trainer_applications')
      .select('full_name')
      .eq('id', doc.trainer_id)
      .single();

    let accountName = '';
    if (app && app.full_name) {
      accountName = app.full_name;
    } else {
      // Fallback: fetch user name from users table
      const { data: userRow } = await supabase
        .from('users')
        .select('name')
        .eq('id', doc.trainer_id)
        .single();
      accountName = userRow?.name || '';
    }

    if (!accountName) {
      return new Response(JSON.stringify({ error: 'Could not find trainer registered account name' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Try Gemini first, then OpenAI
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const openaiKey = Deno.env.get('OPENAI_API_KEY');

    let extractedName = '';
    let confidence = 0;
    let matchResult = 'UNCERTAIN';
    let status = 'MANUAL_REVIEW';

    try {
      if (geminiKey) {
        extractedName = await performOcrGemini(fileBytes, doc.file_type, geminiKey);
      } else if (openaiKey) {
        extractedName = await performOcrOpenAI(fileBytes, doc.file_type, openaiKey);
      } else {
        throw new Error('No AI/OCR credentials configured');
      }

      if (extractedName && extractedName !== 'UNREADABLE') {
        const comparison = compareNames(accountName, extractedName);
        confidence = comparison.confidence;
        if (comparison.matches) {
          matchResult = 'MATCH';
          status = 'VERIFIED';
        } else {
          matchResult = 'MISMATCH';
          status = 'NAME_MISMATCH';
        }
      } else {
        extractedName = 'UNREADABLE';
        status = 'MANUAL_REVIEW';
      }
    } catch (aiErr) {
      console.error('AI processing error:', aiErr);
      extractedName = 'PROCESSING_ERROR';
      status = 'MANUAL_REVIEW';
    }

    // Update verification record
    const { error: updateError } = await supabase
      .from('trainer_verification_documents')
      .update({
        verification_status: status,
        extracted_name: extractedName,
        confidence,
        match_result: matchResult,
        updated_at: new Date().toISOString()
      })
      .eq('id', doc.id);

    if (updateError) {
      console.error('Failed to update verification doc:', updateError);
    }

    return new Response(JSON.stringify({
      success: true,
      verification_status: status,
      extracted_name: extractedName,
      confidence,
      match_result: matchResult
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err: any) {
    console.error('Process ID error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function performOcrGemini(fileBytes: Uint8Array, fileType: string, apiKey: string): Promise<string> {
  const binaryString = Array.from(fileBytes, byte => String.fromCharCode(byte)).join('');
  const base64 = btoa(binaryString);
  const mimeType = fileType === 'pdf' ? 'application/pdf' : `image/${fileType}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { text: "Identify the Full Name printed on this document. Respond with ONLY the extracted full name, or 'UNREADABLE' if you cannot read it. Do not include any explanations or other text. Minimize sensitive details: do not extract ID numbers or other personal data." },
          { inlineData: { mimeType, data: base64 } }
        ]
      }]
    })
  });

  if (!res.ok) {
    throw new Error(`Gemini API error: ${res.statusText}`);
  }
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim();
}

async function performOcrOpenAI(fileBytes: Uint8Array, fileType: string, apiKey: string): Promise<string> {
  const binaryString = Array.from(fileBytes, byte => String.fromCharCode(byte)).join('');
  const base64 = btoa(binaryString);
  const mimeType = fileType === 'pdf' ? 'application/pdf' : `image/${fileType}`;

  const url = 'https://api.openai.com/v1/chat/completions';
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: "Identify the Full Name printed on this document. Respond with ONLY the extracted full name, or 'UNREADABLE' if you cannot read it. Do not include any explanations or other text. Minimize sensitive details: do not extract ID numbers or other personal data." },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
        ]
      }],
      max_tokens: 50
    })
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.statusText}`);
  }
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || '';
  return text.trim();
}
