import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xwwczkjgzyenrrnvrxwl.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bjZzNFDAxiF79ds0CIOqwQ_a6t_OSsf';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);