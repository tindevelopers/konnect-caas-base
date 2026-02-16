import { parsePhoneNumberWithError } from "libphonenumber-js";

export type CampaignRecipientInput = {
  first_name: string;
  last_name?: string;
  phone: string;
  email?: string;
  timezone?: string;
  client_type?: string;
  [key: string]: unknown;
};

export type NormalizedRecipient = {
  first_name: string;
  last_name: string;
  phone: string;
  email: string | null;
  timezone: string;
  client_type: string | null;
  custom_fields: Record<string, unknown>;
};

const DEFAULT_TIMEZONE = "America/New_York";
const US_TIMEZONE_BY_AREA_CODE: Record<string, string> = {
  "201": "America/New_York",
  "202": "America/New_York",
  "212": "America/New_York",
  "213": "America/Los_Angeles",
  "214": "America/Chicago",
  "215": "America/New_York",
  "216": "America/New_York",
  "217": "America/Chicago",
  "218": "America/Chicago",
  "219": "America/Chicago",
  "224": "America/Chicago",
  "225": "America/Chicago",
  "228": "America/Chicago",
  "229": "America/New_York",
  "231": "America/New_York",
  "234": "America/New_York",
  "239": "America/New_York",
  "240": "America/New_York",
  "248": "America/Detroit",
  "251": "America/Chicago",
  "252": "America/New_York",
  "253": "America/Los_Angeles",
  "254": "America/Chicago",
  "256": "America/Chicago",
  "260": "America/New_York",
  "262": "America/Chicago",
  "267": "America/New_York",
  "269": "America/Detroit",
  "270": "America/Chicago",
  "272": "America/New_York",
  "276": "America/New_York",
  "281": "America/Chicago",
  "301": "America/New_York",
  "302": "America/New_York",
  "303": "America/Denver",
  "304": "America/New_York",
  "305": "America/New_York",
  "307": "America/Denver",
  "308": "America/Chicago",
  "309": "America/Chicago",
  "310": "America/Los_Angeles",
  "312": "America/Chicago",
  "313": "America/Detroit",
  "314": "America/Chicago",
  "315": "America/New_York",
  "316": "America/Chicago",
  "317": "America/New_York",
  "318": "America/Chicago",
  "319": "America/Chicago",
  "320": "America/Chicago",
  "321": "America/New_York",
  "323": "America/Los_Angeles",
  "325": "America/Chicago",
  "330": "America/New_York",
  "331": "America/Chicago",
  "334": "America/Chicago",
  "336": "America/New_York",
  "337": "America/Chicago",
  "339": "America/New_York",
  "346": "America/Chicago",
  "347": "America/New_York",
  "351": "America/New_York",
  "352": "America/New_York",
  "360": "America/Los_Angeles",
  "361": "America/Chicago",
  "386": "America/New_York",
  "401": "America/New_York",
  "402": "America/Chicago",
  "404": "America/New_York",
  "405": "America/Chicago",
  "406": "America/Denver",
  "407": "America/New_York",
  "408": "America/Los_Angeles",
  "409": "America/Chicago",
  "410": "America/New_York",
  "412": "America/New_York",
  "413": "America/New_York",
  "414": "America/Chicago",
  "415": "America/Los_Angeles",
  "417": "America/Chicago",
  "419": "America/New_York",
  "423": "America/New_York",
  "424": "America/Los_Angeles",
  "425": "America/Los_Angeles",
  "430": "America/Chicago",
  "432": "America/Chicago",
  "434": "America/New_York",
  "435": "America/Denver",
  "440": "America/New_York",
  "442": "America/Los_Angeles",
  "443": "America/New_York",
  "458": "America/Los_Angeles",
  "469": "America/Chicago",
  "470": "America/New_York",
  "475": "America/New_York",
  "478": "America/New_York",
  "479": "America/Chicago",
  "480": "America/Phoenix",
  "484": "America/New_York",
  "501": "America/Chicago",
  "502": "America/New_York",
  "503": "America/Los_Angeles",
  "504": "America/Chicago",
  "505": "America/Denver",
  "507": "America/Chicago",
  "508": "America/New_York",
  "509": "America/Los_Angeles",
  "510": "America/Los_Angeles",
  "512": "America/Chicago",
  "513": "America/New_York",
  "515": "America/Chicago",
  "516": "America/New_York",
  "517": "America/Detroit",
  "518": "America/New_York",
  "520": "America/Phoenix",
  "530": "America/Los_Angeles",
  "531": "America/Chicago",
  "534": "America/Chicago",
  "539": "America/Chicago",
  "540": "America/New_York",
  "541": "America/Los_Angeles",
  "551": "America/New_York",
  "559": "America/Los_Angeles",
  "561": "America/New_York",
  "562": "America/Los_Angeles",
  "563": "America/Chicago",
  "564": "America/Los_Angeles",
  "567": "America/New_York",
  "570": "America/New_York",
  "571": "America/New_York",
  "573": "America/Chicago",
  "574": "America/New_York",
  "575": "America/Denver",
  "580": "America/Chicago",
  "582": "America/New_York",
  "585": "America/New_York",
  "586": "America/Detroit",
  "601": "America/Chicago",
  "602": "America/Phoenix",
  "603": "America/New_York",
  "605": "America/Chicago",
  "606": "America/New_York",
  "607": "America/New_York",
  "608": "America/Chicago",
  "609": "America/New_York",
  "610": "America/New_York",
  "612": "America/Chicago",
  "614": "America/New_York",
  "615": "America/Chicago",
  "616": "America/Detroit",
  "617": "America/New_York",
  "618": "America/Chicago",
  "619": "America/Los_Angeles",
  "620": "America/Chicago",
  "623": "America/Phoenix",
  "626": "America/Los_Angeles",
  "628": "America/Los_Angeles",
  "629": "America/Chicago",
  "630": "America/Chicago",
  "631": "America/New_York",
  "636": "America/Chicago",
  "641": "America/Chicago",
  "646": "America/New_York",
  "650": "America/Los_Angeles",
  "651": "America/Chicago",
  "656": "America/New_York",
  "657": "America/Los_Angeles",
  "660": "America/Chicago",
  "661": "America/Los_Angeles",
  "662": "America/Chicago",
  "667": "America/New_York",
  "669": "America/Los_Angeles",
  "678": "America/New_York",
  "681": "America/New_York",
  "682": "America/Chicago",
  "701": "America/Chicago",
  "702": "America/Los_Angeles",
  "703": "America/New_York",
  "704": "America/New_York",
  "706": "America/New_York",
  "707": "America/Los_Angeles",
  "708": "America/Chicago",
  "712": "America/Chicago",
  "713": "America/Chicago",
  "714": "America/Los_Angeles",
  "715": "America/Chicago",
  "716": "America/New_York",
  "717": "America/New_York",
  "718": "America/New_York",
  "719": "America/Denver",
  "720": "America/Denver",
  "724": "America/New_York",
  "725": "America/Los_Angeles",
  "726": "America/Chicago",
  "727": "America/New_York",
  "731": "America/Chicago",
  "732": "America/New_York",
  "734": "America/Detroit",
  "737": "America/Chicago",
  "740": "America/New_York",
  "743": "America/New_York",
  "747": "America/Los_Angeles",
  "754": "America/New_York",
  "757": "America/New_York",
  "760": "America/Los_Angeles",
  "762": "America/New_York",
  "763": "America/Chicago",
  "765": "America/New_York",
  "769": "America/Chicago",
  "770": "America/New_York",
  "772": "America/New_York",
  "773": "America/Chicago",
  "774": "America/New_York",
  "775": "America/Los_Angeles",
  "779": "America/Chicago",
  "781": "America/New_York",
  "785": "America/Chicago",
  "786": "America/New_York",
  "801": "America/Denver",
  "802": "America/New_York",
  "803": "America/New_York",
  "804": "America/New_York",
  "805": "America/Los_Angeles",
  "806": "America/Chicago",
  "808": "Pacific/Honolulu",
  "810": "America/Detroit",
  "812": "America/New_York",
  "813": "America/New_York",
  "814": "America/New_York",
  "815": "America/Chicago",
  "816": "America/Chicago",
  "817": "America/Chicago",
  "818": "America/Los_Angeles",
  "828": "America/New_York",
  "830": "America/Chicago",
  "831": "America/Los_Angeles",
  "832": "America/Chicago",
  "843": "America/New_York",
  "845": "America/New_York",
  "847": "America/Chicago",
  "848": "America/New_York",
  "850": "America/Chicago",
  "856": "America/New_York",
  "857": "America/New_York",
  "858": "America/Los_Angeles",
  "859": "America/New_York",
  "860": "America/New_York",
  "862": "America/New_York",
  "863": "America/New_York",
  "864": "America/New_York",
  "865": "America/New_York",
  "870": "America/Chicago",
  "872": "America/Chicago",
  "878": "America/New_York",
  "901": "America/Chicago",
  "903": "America/Chicago",
  "904": "America/New_York",
  "906": "America/Detroit",
  "907": "America/Anchorage",
  "908": "America/New_York",
  "909": "America/Los_Angeles",
  "910": "America/New_York",
  "912": "America/New_York",
  "913": "America/Chicago",
  "914": "America/New_York",
  "915": "America/Chicago",
  "916": "America/Los_Angeles",
  "917": "America/New_York",
  "918": "America/Chicago",
  "919": "America/New_York",
  "920": "America/Chicago",
  "925": "America/Los_Angeles",
  "928": "America/Phoenix",
  "929": "America/New_York",
  "930": "America/New_York",
  "931": "America/Chicago",
  "932": "America/New_York",
  "934": "America/New_York",
  "936": "America/Chicago",
  "937": "America/New_York",
  "938": "America/Chicago",
  "939": "America/Puerto_Rico",
  "940": "America/Chicago",
  "941": "America/New_York",
  "947": "America/Detroit",
  "948": "America/Chicago",
  "949": "America/Los_Angeles",
  "951": "America/Los_Angeles",
  "952": "America/Chicago",
  "954": "America/New_York",
  "956": "America/Chicago",
  "959": "America/New_York",
  "970": "America/Denver",
  "971": "America/Los_Angeles",
  "972": "America/Chicago",
  "973": "America/New_York",
  "975": "America/Chicago",
  "978": "America/New_York",
  "979": "America/Chicago",
  "980": "America/New_York",
  "984": "America/New_York",
  "985": "America/Chicago",
  "986": "America/Boise",
  "989": "America/Detroit",
};

function getTimezoneFromPhone(phone: string): string {
  try {
    const parsed = parsePhoneNumberWithError(phone, "US");
    const country = parsed.countryCallingCode;
    const national = parsed.nationalNumber.toString();
    if (country === "1" && national.length >= 3) {
      const areaCode = national.slice(0, 3);
      return US_TIMEZONE_BY_AREA_CODE[areaCode] ?? DEFAULT_TIMEZONE;
    }
  } catch {
    // Fall through to default
  }
  return DEFAULT_TIMEZONE;
}

export function normalizeRecipient(
  input: CampaignRecipientInput
): { ok: true; data: NormalizedRecipient } | { ok: false; error: string } {
  const firstName = String(input.first_name ?? "").trim();
  const lastName = String(input.last_name ?? "").trim();
  const phoneRaw = String(input.phone ?? "").trim();
  const email = input.email ? String(input.email).trim() : null;
  const clientType = input.client_type ? String(input.client_type).trim() : null;

  if (!firstName) {
    return { ok: false, error: "First name is required" };
  }
  if (!phoneRaw) {
    return { ok: false, error: "Phone number is required" };
  }

  let phoneE164: string;
  try {
    const parsed = parsePhoneNumberWithError(phoneRaw, "US");
    phoneE164 = parsed.format("E.164");
  } catch {
    return { ok: false, error: `Invalid phone number: ${phoneRaw}` };
  }

  const timezone =
    input.timezone && String(input.timezone).trim()
      ? String(input.timezone).trim()
      : getTimezoneFromPhone(phoneE164);

  const customFields: Record<string, unknown> = {};
  const reserved = [
    "first_name",
    "last_name",
    "phone",
    "email",
    "timezone",
    "client_type",
  ];
  for (const [k, v] of Object.entries(input)) {
    if (!reserved.includes(k) && v != null && v !== "") {
      customFields[k] = v;
    }
  }

  return {
    ok: true,
    data: {
      first_name: firstName,
      last_name: lastName || "",
      phone: phoneE164,
      email: email || null,
      timezone,
      client_type: clientType || null,
      custom_fields: customFields,
    },
  };
}

export function deduplicateByPhone(
  recipients: NormalizedRecipient[]
): NormalizedRecipient[] {
  const seen = new Set<string>();
  return recipients.filter((r) => {
    const key = r.phone;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
