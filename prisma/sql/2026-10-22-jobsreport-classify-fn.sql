create or replace function jobsreport_classify(p_all boolean default false)
returns integer language plpgsql security definer set search_path = public as $fn$
declare n integer;
begin
update jobsreport_posting p set
  level = c.level, function = c.fn,
  occupation_group = case
    when c.fn in ('Non-white-collar occupations', 'Sales (not white-collar)') then '3 other occupations'
    when c.fn in ('Management, business and operations', 'Finance and accounting', 'HR and recruiting', 'Supply chain and logistics') then '1 management, business and financial'
    when c.fn = 'Unclassified' then 'unclassified'
    else '2 professional and related' end,
  white_collar = case
    when c.fn in ('Non-white-collar occupations', 'Sales (not white-collar)') then false
    when c.fn = 'Unclassified' then null else true end,
  tag_rule_version = '2026-10-16.3'
from (
  select posting_id,
    case
      when t ~ '\m(chief|president|vice president|vp|svp|evp)\M' and t !~ 'vice principal' then 'VP_PLUS'
      when t !~ '\m(senior|sr|lead|principal)\M' and (t ~ '\m(intern|internship|trainee|apprentice|entry|junior|jr|aide|clerk|representative|paraprofessional)\M'
        or (t ~ '\massistant\M' and t !~ '(physician assistant|assistant (\w+ )?(manager|director|coach|professor|principal|dean|superintendent|controller|treasurer|chief|general|city|county|attorney|vice|commissioner|nurse)|coach)')
        or t ~ '\m(coordinator|specialist|analyst|technician) (i|1)\M') then 'ENTRY'
      when t ~ '\m(director|head of|dean|superintendent)\M'
        or (t ~ '\mprincipal\M' and t !~ '\mprincipal (engineer|scientist|analyst|developer|architect|consultant|software|data|investigator|physician)') then 'DIRECTOR'
      when t ~ '\m(manager|supervisor|administrator|lead|chair)\M' then 'MANAGER'
      when t ~ '\m(senior|sr|staff|principal|iii|iv)\M' then 'SENIOR_IC'
      else 'MID_IC' end as level,
    case
      when t ~ '\m(cna|nursing assistant|nurse aide|patient care (tech\w*|assistant)|patient sitter|orderly|phlebotom\w*|medical assistant|sterile processing|central supply|dental assistant|physical therapy assistant|occupational therapy assistant|rehab(ilitation)? tech\w*|dietary|cook|dishwasher|environmental services|housekeep\w*|custodian|custodial|janitor\w*|laundry|patient transport\w*|cafeteria|bus driver|driver|crossing guard|security officer|groundskeeper|mechanic|electrician|plumber|welder|machine operator|operator|assembler|warehouse|forklift|material handler|cashier|barista|team member|crew member|store associate|sales associate|server|host|food service|attendant|bus monitor|student worker|lifeguard|mover|laborer|shift leader|shift manager|teller|csr|scheduling coordinator|scheduler|correctional officer|police officer|officer|firefighter|restaurant manager|roofer|carpenter|painter|hvac|traffic guard|accounts (receivable|payable)|(er|ed|ekg|mental health|emergency dept) tech\w*|activity based tech\w*)\M' then 'Non-white-collar occupations'
      when t ~ '\m(software|developer|programmer|devops|cloud|cyber\w*|network|information technology|technology|it|data engineer|machine learning|architect|database|help ?desk|web)\M' or t ~ '\msystems? (admin\w*|analyst|engineer)' then 'Technology and IT'
      when t ~ '\m(data scientist|data analyst|business intelligence|analytics|statistician)' then 'Data and analytics'
      when t ~ '\m(nurse|rn|lpn|np|app|physician|surgeon|md|pharmacist|pharmacy tech\w*|surgical tech\w*|emt|paramedic|therapist|radiolog\w+|neuroradiolog\w+|sonograph\w+|technologist|histotech\w*|perfusionist|athletic trainer|dietitian|audiolog\w+|dentist|hygienist|optometrist|psycholog\w+|clinician|clinical|respiratory|anesthes\w+|crna|practitioner|speech|pathologist|nutritionist|hospitalist|provider|critical care|acuity|icu|nicu|picu|emergency department|emergency medicine|operating room|surgical assistant|emergency med tech\w*|pediatric\w*|\w*ologist)\M'
        or t ~ '\m(x-?ray|ct|mri|mammography|ultrasound|nuclear|echo|cardiac|vascular|cath lab|lab) (tech\w*|technologist)' then 'Healthcare practitioners'
      when t ~ '\m(social worker|counselor|case manager|chaplain|community health|care coordinator|care manager|behavioral|caseworker|navigator|social services)\M' then 'Community and social service'
      when t ~ '\m(teacher|instructor|instructional|professor|lecturer|librarian|library (assistant|technician)|faculty|educator|tutor|coach|curriculum|principal|dean|adjunct|resident|substitute)\M' then 'Education and training'
      when t ~ '\m(attorney|counsel|lawyer|paralegal|legal)\M' then 'Legal'
      when t ~ '\m(accountant|accounting|auditor|audit|financ\w+|controller|treasur\w+|underwrit\w+|loan|credit|banker|tax|payroll|billing|revenue|actuar\w+|investment|budget\w*)\M' then 'Finance and accounting'
      when t ~ '\m(human resources|hr|recruit\w+|talent|benefits|compensation|generalist|learning and development)\M' then 'HR and recruiting'
      when t ~ '\m(marketing|communications?|public relations|brand|designer|design|writer|editor|journalist|producer|content|creative|social media|graphic)\M' then 'Marketing, media and design'
      when t ~ '\m(supply chain|logistics|procure\w+|purchasing|sourcing|buyer|planner|inventory|distribution)\M' then 'Supply chain and logistics'
      when t ~ '\m(engineer|engineering|scientist|researcher|research|chemist|biolog\w+|laboratory|lab|quality|process improvement|industrial|mechanical|electrical|civil|manufacturing)\M' then 'Engineering and science'
      when t ~ '\m(sales|account executive|business development|customer success)\M' and t !~ '\mmanager\M' then 'Sales (not white-collar)'
      when t ~ '\m(compliance|risk|regulatory|policy|consultant|analyst|specialist|project|program|operations|planning|strategy|strategic|business|administrator|manager|director|executive|superintendent|chief|president|head)\M' then 'Management, business and operations'
      when t ~ '\m(receptionist|secretary|registration|patient access|unit clerk|unit secretary|call center|customer service|administrative assistant|office|data entry)\M' then 'Non-white-collar occupations'
      else 'Unclassified' end as fn
  from (select posting_id, lower(title) t from jobsreport_posting where p_all or tag_rule_version is null) x
) c
where p.posting_id = c.posting_id;
get diagnostics n = row_count;
return n;
end
$fn$;
revoke all on function jobsreport_classify(boolean) from public, anon, authenticated;
