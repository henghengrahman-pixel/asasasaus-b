import {test,expect} from '@playwright/test';

test('homepage desktop visual smoke + SEO',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/Semua Jasa.*Batam.*Lebih Mudah/i})).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href',/\/$/);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(overflow).toBeFalsy();
});

test('homepage mobile 390 no horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await expect(page.locator('.site-v6-bottom-nav')).toBeVisible();
  await expect(page.locator('.home-v6-search')).toBeVisible();
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
  expect(overflow).toBeFalsy();
});

test('services page',async({page})=>{
  await page.goto('/jasa');
  await expect(page.getByRole('heading',{name:/Semua Jasa di Batam|Jasa di .*Batam/i})).toBeVisible();
});
