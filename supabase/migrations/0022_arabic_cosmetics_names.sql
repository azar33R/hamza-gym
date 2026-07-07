-- Replace cosmetic names/values with Arabic nicknames and banners.

-- Nicknames
UPDATE public.cosmetics SET name = 'لسه بيسخن',   value = 'لسه بيسخن'   WHERE type = 'nickname' AND value = 'Newcomer';
UPDATE public.cosmetics SET name = 'فورمة الساحل', value = 'فورمة الساحل' WHERE type = 'nickname' AND value = 'Striver';
UPDATE public.cosmetics SET name = 'عاش يا بطل',   value = 'عاش يا بطل'   WHERE type = 'nickname' AND value = 'Apex';
UPDATE public.cosmetics SET name = 'مكنة أوزان',    value = 'مكنة أوزان'    WHERE type = 'nickname' AND value = 'Legend';
UPDATE public.cosmetics SET name = 'الدبابة',       value = 'الدبابة'       WHERE type = 'nickname' AND value = 'The Beast';
UPDATE public.cosmetics SET name = 'مقطّع السمكة',  value = 'مقطّع السمكة'  WHERE type = 'nickname' AND value = 'Iron Hammer';
UPDATE public.cosmetics SET name = 'كبير الجيم',    value = 'كبير الجيم'    WHERE type = 'nickname' AND value = 'Nightwolf';
UPDATE public.cosmetics SET name = 'مقفّل العداد',  value = 'مقفّل العداد'  WHERE type = 'nickname' AND value = 'Phantom';

-- Banners (value stays as the gradient key)
UPDATE public.cosmetics SET name = 'شرار الحديد'   WHERE type = 'banner' AND value = 'iron';
UPDATE public.cosmetics SET name = 'حريقة أوزان'    WHERE type = 'banner' AND value = 'bronze';
UPDATE public.cosmetics SET name = 'بطل من دهب'     WHERE type = 'banner' AND value = 'gold';
UPDATE public.cosmetics SET name = 'فورمة ألماظ'    WHERE type = 'banner' AND value = 'diamond';
UPDATE public.cosmetics SET name = 'باور عالي'      WHERE type = 'banner' AND value = 'lime';
UPDATE public.cosmetics SET name = 'من كوكب تاني'   WHERE type = 'banner' AND value = 'inferno';
UPDATE public.cosmetics SET name = 'ملك الحديد'     WHERE type = 'banner' AND value = 'galaxy';
UPDATE public.cosmetics SET name = 'أعصاب تلاجة'    WHERE type = 'banner' AND value = 'purple';
