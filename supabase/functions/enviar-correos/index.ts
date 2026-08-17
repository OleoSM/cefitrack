import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0'

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type' }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:cors})
  try {
    const auth = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:auth}}})
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user || user.app_metadata?.role !== 'admin') return new Response('Forbidden',{status:403,headers:cors})

    const { draftId } = await req.json()
    const { data:draft,error } = await supabase.from('email_drafts').select('*').eq('id',draftId).single()
    if (error || !draft) throw error ?? new Error('Borrador inexistente')
    const { data:students,error:studentsError } = await supabase.from('students')
      .select('id,name,personal_email,email,tutor_email').in('id',draft.student_ids)
    if (studentsError) throw studentsError

    const apiKey=Deno.env.get('RESEND_API_KEY')
    const from=Deno.env.get('RESEND_FROM')
    if (!apiKey||!from) return Response.json({ok:false,pending:true,message:'Resend pendiente de configuración'},{status:503,headers:cors})

    const recipients=(students??[]).flatMap(s=>[
      ...(draft.include_student?[s.personal_email||s.email]:[]),
      ...(draft.include_tutor?[s.tutor_email]:[]),
    ]).filter(Boolean)
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from,to:[...new Set(recipients)],subject:draft.subject,html:`<div style="white-space:pre-wrap">${draft.body.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]!))}</div>`})})
    if (!response.ok) throw new Error(`Resend ${response.status}: ${await response.text()}`)
    await supabase.from('email_drafts').update({status:'sent',sent_at:new Date().toISOString()}).eq('id',draftId)
    await supabase.from('notifications').insert((students??[]).map(s=>({
      recipient_student_id:s.id,
      title:'Correo enviado',
      body:`CEFIMAT te envió un correo: ${draft.subject}`,
      event_type:'email_sent',
      created_by:user.id,
    })))
    return Response.json({ok:true,recipients:recipients.length},{headers:cors})
  } catch (error) {
    return Response.json({ok:false,error:error instanceof Error?error.message:'Error desconocido'},{status:400,headers:cors})
  }
})
