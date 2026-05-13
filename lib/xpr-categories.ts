/**
 * Map investigation category to XPR category tags (closer to client bulletin examples).
 */
export function categoriesFromInvestigation(category: string | undefined): string[] {
  const c = (category ?? '').toLowerCase()
  if (c.includes('platform') || c.includes('child safety') || c.includes('minor')) {
    return ['Platform Safety', 'Child Safety', 'Legal & Regulatory', 'Technology', 'Investor Risk']
  }
  if (c.includes('consumer')) {
    return ['Consumer Protection', 'Legal & Regulatory', 'Business', 'Investor Risk']
  }
  if (c.includes('telecom') || c.includes('network')) {
    return ['Telecommunications', 'Consumer Protection', 'Legal & Regulatory', 'Technology', 'Investor Risk']
  }
  return ['Legal', 'Press Releases', 'Business', 'Investor Risk']
}
