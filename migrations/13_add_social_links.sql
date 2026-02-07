-- Add social media columns to providers table
alter table public.providers 
add column if not exists social_facebook text,
add column if not exists social_instagram text,
add column if not exists social_website text;

-- Add helper comment
comment on column public.providers.social_facebook is 'URL to Facebook profile';
comment on column public.providers.social_instagram is 'URL to Instagram profile';
comment on column public.providers.social_website is 'URL to personal website or portfolio';
