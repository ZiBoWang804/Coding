export async function isHolidayDate(date: string) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}
