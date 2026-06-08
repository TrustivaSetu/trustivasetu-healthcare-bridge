export type HolidayType = 'gazetted' | 'restricted' | 'festival' | 'regional'
export type Religion =
  | 'National' | 'Hindu' | 'Muslim' | 'Christian' | 'Sikh'
  | 'Buddhist' | 'Jain' | 'Parsi' | 'Regional'

export interface IndiaHoliday {
  name: string
  date: string            // YYYY-MM-DD
  type: HolidayType
  religion: Religion
  state?: string          // if regional, which state(s)
  note?: string           // extra context
}

// Day-of-week helper (pure, no date-fns needed)
export function getDayName(dateStr: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const d = new Date(dateStr + 'T00:00:00Z')
  return days[d.getUTCDay()]
}

export function isSunday(dateStr: string): boolean {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay() === 0
}

export function isSaturday(dateStr: string): boolean {
  return new Date(dateStr + 'T00:00:00Z').getUTCDay() === 6
}

// ─── COMPREHENSIVE HOLIDAY LIST ──────────────────────────────────────────────
// Covers: Jan 2026 – Mar 2027
// Islamic dates marked [approx] — subject to moon-sighting confirmation
// Lunar Hindu/Jain dates calculated from standard Drik Panchang
// ──────────────────────────────────────────────────────────────────────────────

export const HOLIDAYS_PERIOD = 'Jan 2026 – Mar 2027'

export const INDIA_HOLIDAYS_2025_26: IndiaHoliday[] = [

  // ── JANUARY 2026 ────────────────────────────────────────────────────────────

  { name: "New Year's Day", date: '2026-01-01', type: 'festival', religion: 'Regional', note: 'Optional / Regional' },
  { name: 'Guru Gobind Singh Jayanti', date: '2026-01-06', type: 'restricted', religion: 'Sikh', note: '359th birth anniversary; date per Nanakshahi calendar' },
  { name: 'Lohri', date: '2026-01-13', type: 'regional', religion: 'Sikh', state: 'Punjab, Haryana', note: 'Jan 13 fixed annually; harvest festival marking end of winter' },
  { name: 'Makar Sankranti', date: '2026-01-14', type: 'restricted', religion: 'Hindu', note: 'Solar new year; sun enters Capricorn; Jan 14 fixed annually' },
  { name: 'Pongal (Thai Pongal)', date: '2026-01-14', type: 'regional', religion: 'Hindu', state: 'Tamil Nadu', note: '4-day harvest festival; Jan 14 fixed' },
  { name: 'Bhogali Bihu (Magh Bihu)', date: '2026-01-15', type: 'regional', religion: 'Regional', state: 'Assam', note: 'Harvest festival marking end of harvesting season' },
  { name: 'Vasant Panchami (Saraswati Puja)', date: '2026-01-22', type: 'restricted', religion: 'Hindu', note: 'Magha Shukla Panchami; goddess of learning' },
  { name: 'Republic Day', date: '2026-01-26', type: 'gazetted', religion: 'National', note: '77th Republic Day — Constitution came into force 1950' },

  // ── FEBRUARY 2026 ───────────────────────────────────────────────────────────

  { name: 'Shab-e-Barat', date: '2026-02-03', type: 'restricted', religion: 'Muslim', note: '15th night of Sha\'ban; Night of Forgiveness [approx]' },
  { name: 'Maha Shivratri', date: '2026-02-15', type: 'restricted', religion: 'Hindu', note: 'Phalguna Krishna Chaturdashi; fast for Lord Shiva [falls on Sunday]' },
  { name: 'Ash Wednesday', date: '2026-02-18', type: 'restricted', religion: 'Christian', note: 'Marks beginning of Lent; 40 days before Easter Sunday' },

  // ── MARCH 2026 ──────────────────────────────────────────────────────────────

  { name: 'Holika Dahan', date: '2026-03-02', type: 'festival', religion: 'Hindu', note: 'Eve of Holi; burning of Holika (evil)' },
  { name: 'Holi', date: '2026-03-03', type: 'gazetted', religion: 'Hindu', note: 'Festival of colours; Phalguna Purnima' },
  { name: 'Chapchar Kut', date: '2026-03-06', type: 'regional', religion: 'Regional', state: 'Mizoram', note: 'Spring festival; first Friday of March after jungle clearing' },
  { name: 'Ugadi (Yugadi)', date: '2026-03-19', type: 'regional', religion: 'Hindu', state: 'Andhra Pradesh, Telangana, Karnataka', note: 'Telugu & Kannada New Year; Chaitra Shukla Pratipada' },
  { name: 'Gudi Padwa', date: '2026-03-19', type: 'regional', religion: 'Hindu', state: 'Maharashtra', note: 'Marathi New Year; Chaitra Shukla Pratipada' },
  { name: 'Id-ul-Fitr (Eid)', date: '2026-03-20', type: 'gazetted', religion: 'Muslim', note: 'End of Ramadan; festival of breaking fast [approx — moon sighting]' },

  // ── APRIL 2026 ──────────────────────────────────────────────────────────────

  { name: 'Good Friday', date: '2026-04-03', type: 'gazetted', religion: 'Christian', note: 'Crucifixion of Jesus Christ; 2 days before Easter' },
  { name: 'Easter Sunday', date: '2026-04-05', type: 'restricted', religion: 'Christian', note: 'Resurrection of Jesus Christ [falls on Sunday]' },
  { name: 'Baisakhi (Vaisakhi)', date: '2026-04-14', type: 'regional', religion: 'Sikh', state: 'Punjab, Haryana', note: 'Sikh New Year; founding of Khalsa Panth 1699; harvest festival' },
  { name: 'Vishu', date: '2026-04-14', type: 'regional', religion: 'Hindu', state: 'Kerala', note: 'Malayalam New Year; first day of Medam; Vishukkani ritual' },
  { name: 'Dr. Ambedkar Jayanti', date: '2026-04-14', type: 'restricted', religion: 'Buddhist', note: '135th birth anniversary of Dr. B. R. Ambedkar; observed nationally' },
  { name: 'Mahavir Jayanti', date: '2026-04-23', type: 'gazetted', religion: 'Jain', note: 'Chaitra Shukla Trayodashi; birth anniversary of Tirthankara Mahavira' },
  { name: 'Ram Navami', date: '2026-04-26', type: 'restricted', religion: 'Hindu', note: 'Chaitra Shukla Navami; birth of Lord Rama [falls on Sunday]' },
  { name: 'Hanuman Jayanti', date: '2026-04-27', type: 'restricted', religion: 'Hindu', note: 'Chaitra Purnima; birth of Lord Hanuman' },

  // ── MAY 2026 ────────────────────────────────────────────────────────────────

  { name: 'Akshaya Tritiya', date: '2026-05-20', type: 'festival', religion: 'Hindu', note: 'Vaishakha Shukla Tritiya; auspicious day; gold purchase tradition' },
  { name: 'Buddha Purnima (Vesak)', date: '2026-05-31', type: 'gazetted', religion: 'Buddhist', note: 'Vaishakha Purnima; birth, enlightenment & Parinirvana of Gautama Buddha [falls on Sunday]' },

  // ── JUNE 2026 ───────────────────────────────────────────────────────────────

  { name: 'Id-ul-Zuha (Bakrid / Eid-ul-Adha)', date: '2026-06-27', type: 'gazetted', religion: 'Muslim', note: 'Feast of sacrifice; Ibrahim\'s devotion; Hajj culmination [approx — moon sighting]' },

  // ── JULY 2026 ───────────────────────────────────────────────────────────────

  { name: 'Guru Purnima', date: '2026-07-11', type: 'festival', religion: 'Hindu', note: 'Ashadha Purnima; reverence for spiritual and academic teachers' },
  { name: 'Rath Yatra', date: '2026-07-16', type: 'regional', religion: 'Hindu', state: 'Odisha (Puri; national significance)', note: 'Ashadha Shukla Dwitiya; chariot procession of Lord Jagannath' },
  { name: 'Muharram (Ashura)', date: '2026-07-17', type: 'gazetted', religion: 'Muslim', note: 'Islamic New Year; 10th Muharram marks martyrdom of Imam Hussain [approx]' },

  // ── AUGUST 2026 ─────────────────────────────────────────────────────────────

  { name: 'Raksha Bandhan', date: '2026-08-02', type: 'restricted', religion: 'Hindu', note: 'Shravan Purnima; brother-sister bond; tying of sacred thread [falls on Sunday]' },
  { name: 'Independence Day', date: '2026-08-15', type: 'gazetted', religion: 'National', note: '80th Independence Day; end of British rule 1947' },
  { name: 'Janmashtami', date: '2026-08-15', type: 'gazetted', religion: 'Hindu', note: 'Bhadrapada Krishna Ashtami; birth of Lord Krishna; midnight celebration [coincides with Independence Day]' },
  { name: 'Pateti', date: '2026-08-15', type: 'restricted', religion: 'Parsi', note: 'Last day of Zoroastrian Shahenshahi year; day of introspection [coincides with Independence Day]' },
  { name: 'Parsi New Year (Navroz)', date: '2026-08-16', type: 'restricted', religion: 'Parsi', note: 'Shahenshahi calendar; Zoroastrian new year; celebrated in Maharashtra & Gujarat [falls on Sunday]' },
  { name: 'Onam (Thiruvonam)', date: '2026-08-25', type: 'regional', religion: 'Hindu', state: 'Kerala', note: 'Thiruvonam nakshatra; 10-day harvest festival; return of King Mahabali [approx]' },

  // ── SEPTEMBER 2026 ──────────────────────────────────────────────────────────

  { name: 'Milad-un-Nabi (Eid-e-Milad)', date: '2026-09-04', type: 'gazetted', religion: 'Muslim', note: '12th Rabi-ul-Awwal; birth anniversary of Prophet Muhammad [approx]' },
  { name: 'Paryushana (Jain Shwetambar) — Begins', date: '2026-09-09', type: 'regional', religion: 'Jain', note: '8-day period of fasting & reflection [approx per Shwetambar panchang]' },
  { name: 'Ganesh Chaturthi (Vinayaka Chaturthi)', date: '2026-09-13', type: 'restricted', religion: 'Hindu', note: 'Bhadrapada Shukla Chaturthi; 10-day festival; major in Maharashtra, Karnataka, AP, Telangana [falls on Sunday]' },
  { name: 'Samvatsari (Jain)', date: '2026-09-17', type: 'restricted', religion: 'Jain', note: 'Last & holiest day of Paryushana; universal forgiveness — Micchami Dukkadam' },

  // ── OCTOBER 2026 ────────────────────────────────────────────────────────────

  { name: 'Gandhi Jayanti', date: '2026-10-02', type: 'gazetted', religion: 'National', note: '157th birth anniversary of Mahatma Gandhi; International Day of Non-Violence (UN)' },
  { name: 'Navratri (Sharad) — Begins', date: '2026-10-08', type: 'festival', religion: 'Hindu', note: 'Ashwin Shukla Pratipada; 9 nights of Durga worship; Garba & Dandiya' },
  { name: 'Durga Puja — Maha Ashtami', date: '2026-10-15', type: 'regional', religion: 'Hindu', state: 'West Bengal (national importance)', note: 'Ashwin Shukla Ashtami; most important day of Durga Puja; sandhi puja' },
  { name: 'Dussehra (Vijaya Dashami)', date: '2026-10-17', type: 'gazetted', religion: 'Hindu', note: 'Ashwin Shukla Dashami; victory of Rama over Ravana; Ravan dahan' },
  { name: 'Karwa Chauth', date: '2026-10-22', type: 'regional', religion: 'Hindu', state: 'North India (Punjab, Haryana, UP, Rajasthan, Delhi)', note: 'Kartik Krishna Chaturthi; wives fast for husbands\' longevity; moonrise ritual' },

  // ── NOVEMBER 2026 ───────────────────────────────────────────────────────────

  { name: 'Dhanteras (Dhanatrayodashi)', date: '2026-11-02', type: 'festival', religion: 'Hindu', note: 'Kartik Krishna Trayodashi; first day of Diwali festival; purchase of gold/silver/utensils' },
  { name: 'Diwali (Deepavali)', date: '2026-11-04', type: 'gazetted', religion: 'Hindu', note: 'Kartik Amavasya; festival of lights; Lakshmi Puja; firecrackers' },
  { name: 'Bhai Dooj (Bhau-Beej)', date: '2026-11-06', type: 'festival', religion: 'Hindu', note: 'Kartik Shukla Dwitiya; brother-sister celebration; Yama-Yamuna legend' },
  { name: 'Chhath Puja', date: '2026-11-08', type: 'regional', religion: 'Hindu', state: 'Bihar, Uttar Pradesh, Jharkhand, Delhi NCR', note: 'Kartik Shukla Shashthi; worship of Sun god; sunset & sunrise offerings from riverbanks [falls on Sunday]' },
  { name: 'Dev Uthani Ekadashi (Devutthana)', date: '2026-11-11', type: 'festival', religion: 'Hindu', note: 'Kartik Shukla Ekadashi; Lord Vishnu wakes from 4-month sleep (Chaturmas ends); marriage season begins' },
  { name: 'Guru Nanak Jayanti (Gurpurab)', date: '2026-11-23', type: 'gazetted', religion: 'Sikh', note: 'Kartik Purnima; 557th birth anniversary of Guru Nanak Dev Ji; Nagar Kirtan processions' },

  // ── DECEMBER 2026 ───────────────────────────────────────────────────────────

  { name: 'Hornbill Festival — Opens', date: '2026-12-01', type: 'regional', religion: 'Regional', state: 'Nagaland (Kohima)', note: '10-day festival (Dec 1–10); tribal heritage celebration; all 16 Naga tribes participate' },
  { name: 'Christmas', date: '2026-12-25', type: 'gazetted', religion: 'Christian', note: 'Birth of Jesus Christ' },

  // ── JANUARY 2027 ────────────────────────────────────────────────────────────

  { name: "New Year's Day 2027", date: '2027-01-01', type: 'festival', religion: 'Regional', note: 'Optional / Regional' },
  { name: 'Lohri 2027', date: '2027-01-13', type: 'regional', religion: 'Sikh', state: 'Punjab, Haryana', note: 'Jan 13 fixed annually; harvest festival marking end of winter' },
  { name: 'Makar Sankranti 2027', date: '2027-01-14', type: 'restricted', religion: 'Hindu', note: 'Jan 14 fixed annually; sun enters Capricorn' },
  { name: 'Pongal 2027', date: '2027-01-14', type: 'regional', religion: 'Hindu', state: 'Tamil Nadu', note: '4-day harvest festival; Jan 14 fixed' },
  { name: 'Shab-e-Barat 2027', date: '2027-01-23', type: 'restricted', religion: 'Muslim', note: '15th night of Sha\'ban; Night of Forgiveness [approx]' },
  { name: 'Republic Day 2027', date: '2027-01-26', type: 'gazetted', religion: 'National', note: '78th Republic Day' },

  // ── FEBRUARY 2027 ───────────────────────────────────────────────────────────

  { name: 'Vasant Panchami (Saraswati Puja) 2027', date: '2027-02-11', type: 'restricted', religion: 'Hindu', note: 'Magha Shukla Panchami; goddess of learning' },
  { name: 'Maha Shivratri 2027', date: '2027-02-17', type: 'restricted', religion: 'Hindu', note: 'Phalguna Krishna Chaturdashi; fast for Lord Shiva' },

  // ── MARCH 2027 ──────────────────────────────────────────────────────────────

  { name: 'Chapchar Kut 2027', date: '2027-03-05', type: 'regional', religion: 'Regional', state: 'Mizoram', note: 'Spring festival; first Friday of March after jungle clearing' },
  { name: 'Id-ul-Fitr 2027 (Eid)', date: '2027-03-09', type: 'gazetted', religion: 'Muslim', note: 'End of Ramadan; festival of breaking fast [approx — moon sighting]' },
  { name: 'Ugadi 2027', date: '2027-03-18', type: 'regional', religion: 'Hindu', state: 'Andhra Pradesh, Telangana, Karnataka', note: 'Telugu & Kannada New Year [approx]' },
  { name: 'Gudi Padwa 2027', date: '2027-03-18', type: 'regional', religion: 'Hindu', state: 'Maharashtra', note: 'Marathi New Year [approx]' },
  { name: 'Holika Dahan 2027', date: '2027-03-21', type: 'festival', religion: 'Hindu', note: 'Eve of Holi; burning of Holika (evil) [falls on Sunday]' },
  { name: 'Holi 2027', date: '2027-03-22', type: 'gazetted', religion: 'Hindu', note: 'Festival of colours; Phalguna Purnima' },
]
