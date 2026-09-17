import type { Account, Address, BrewfittTeamMember, Contact, ContactRole, PaymentTerms, Sector } from "@/types";
import ukPostcodes from "../data/uk-postcodes.json";
import { addDays, isoDateTime } from "../clock";
import type { Rng } from "../random";

/**
 * Invented accounts and people. None of these are real Brewfitt customers or
 * suppliers; any resemblance to a real business is unintended.
 */

export const BREWFITT_TEAM: BrewfittTeamMember[] = [
  { id: "tm_rachel", name: "Rachel Haigh", role: "account-manager", email: "rachel.haigh@brewfitt.example", phone: "01484 530 211", avatar: null },
  { id: "tm_daniel", name: "Daniel Okafor", role: "account-manager", email: "daniel.okafor@brewfitt.example", phone: "01484 530 214", avatar: null },
  { id: "tm_fiona", name: "Fiona Macrae", role: "account-manager", email: "fiona.macrae@brewfitt.example", phone: "01484 530 217", avatar: null },
  { id: "tm_mark", name: "Mark Sutcliffe", role: "technical-manager", email: "mark.sutcliffe@brewfitt.example", phone: "01484 530 220", avatar: null },
  { id: "tm_joanne", name: "Joanne Firth", role: "buyer", email: "joanne.firth@brewfitt.example", phone: "01484 530 225", avatar: null },
  { id: "tm_priya", name: "Priya Patel", role: "sales-office", email: "priya.patel@brewfitt.example", phone: "01484 530 200", avatar: null },
  { id: "tm_helen", name: "Helen Brook", role: "credit-control", email: "helen.brook@brewfitt.example", phone: "01484 530 230", avatar: null },
  { id: "tm_craig", name: "Craig Lockwood", role: "service-engineer", email: "craig.lockwood@brewfitt.example", phone: "07700 900 412", avatar: null },
];

type PlaceRef =
  | { outcode: string }
  | { country: "IE" | "NL" | "AE"; postcode: string | null; town: string; county: string | null; latitude: number; longitude: number };

type AccountSeed = {
  id: string;
  name: string;
  kind: "customer" | "supplier";
  sector: Sector;
  parent?: string;
  isGroup?: boolean;
  terms: PaymentTerms;
  onAccount: boolean;
  /** Pounds. */
  creditLimit?: number;
  priceList: string | null;
  manager: string | null;
  technical?: string;
  buyer?: string;
  health: Account["relationshipHealth"];
  sinceMonths: number;
  street: string;
  place: PlaceRef;
  /** Extra delivery sites: label, street, place, notes. */
  deliverySites?: { label: string; street: string; place: PlaceRef; notes: string | null }[];
  contacts: { name: string; title: string; role: ContactRole; approve?: boolean }[];
};

const DUBLIN: PlaceRef = { country: "IE", postcode: "D02", town: "Dublin", county: "County Dublin", latitude: 53.3398, longitude: -6.2603 };
const CORK: PlaceRef = { country: "IE", postcode: "T12", town: "Cork", county: "County Cork", latitude: 51.8985, longitude: -8.4756 };
const AMSTERDAM: PlaceRef = { country: "NL", postcode: "1017 CT", town: "Amsterdam", county: "Noord-Holland", latitude: 52.3664, longitude: 4.8968 };
const ROTTERDAM: PlaceRef = { country: "NL", postcode: "3011 AD", town: "Rotterdam", county: "Zuid-Holland", latitude: 51.9228, longitude: 4.4793 };
const DUBAI: PlaceRef = { country: "AE", postcode: null, town: "Dubai", county: null, latitude: 25.2607, longitude: 55.3091 };

export const ACCOUNT_SEEDS: AccountSeed[] = [
  // ---------- Breweries ----------
  {
    id: "acc_pennine", name: "Pennine Stack Brewery", kind: "customer", sector: "brewery", terms: "30-days-eom", onAccount: true, creditLimit: 40000,
    priceList: "pl_brewery", manager: "tm_rachel", technical: "tm_mark", health: "strong", sinceMonths: 96, street: "Unit 4, Colne Bridge Works", place: { outcode: "HD1" },
    deliverySites: [
      { label: "Brewery tap room", street: "Colne Bridge Yard", place: { outcode: "HD8" }, notes: "Use the side gate on the left; tap room opens at 12:00." },
    ],
    contacts: [
      { name: "Tom Wainwright", title: "Head Brewer", role: "technical", approve: true },
      { name: "Sarah Crowther", title: "Operations Manager", role: "buyer", approve: true },
      { name: "Imran Hussain", title: "Finance Manager", role: "finance" },
    ],
  },
  {
    id: "acc_calder", name: "Calder Weir Brewing Co", kind: "customer", sector: "brewery", terms: "30-days", onAccount: true, creditLimit: 25000,
    priceList: "pl_brewery", manager: "tm_rachel", technical: "tm_mark", health: "steady", sinceMonths: 54, street: "Weir Mill, Dean Clough Road", place: { outcode: "HX1" },
    contacts: [
      { name: "Lewis Barraclough", title: "Director", role: "buyer", approve: true },
      { name: "Megan Holroyd", title: "Brewery Technician", role: "technical" },
    ],
  },
  {
    id: "acc_trent", name: "Trent Maltings Brewery", kind: "customer", sector: "brewery", terms: "30-days-eom", onAccount: true, creditLimit: 60000,
    priceList: "pl_brewery", manager: "tm_daniel", technical: "tm_mark", health: "strong", sinceMonths: 132, street: "Maltings Wharf, Derby Street", place: { outcode: "DE14" },
    deliverySites: [
      { label: "Trade dispense store", street: "Unit 9, Centrum Park", place: { outcode: "DE1" }, notes: "Goods in 07:00–14:00 weekdays." },
    ],
    contacts: [
      { name: "Graham Pickering", title: "Trade Dispense Manager", role: "technical", approve: true },
      { name: "Anita Sandhu", title: "Procurement Lead", role: "buyer", approve: true },
      { name: "Chris Allsopp", title: "Accounts Payable", role: "finance" },
    ],
  },
  {
    id: "acc_copperhouse", name: "Copperhouse Brewing", kind: "customer", sector: "brewery", terms: "30-days", onAccount: true, creditLimit: 20000,
    priceList: "pl_brewery", manager: "tm_fiona", technical: "tm_mark", health: "steady", sinceMonths: 38, street: "12 Commercial Quay", place: { outcode: "EH6" },
    contacts: [
      { name: "Callum Reid", title: "Co-founder", role: "buyer", approve: true },
      { name: "Eilidh Fraser", title: "Taproom Manager", role: "bar-manager" },
    ],
  },
  // ---------- Brand owners ----------
  {
    id: "acc_harbourside", name: "Harbourside Drinks Ltd", kind: "customer", sector: "brand-owner", terms: "30-days-eom", onAccount: true, creditLimit: 120000,
    priceList: "pl_brand", manager: "tm_daniel", technical: "tm_mark", health: "strong", sinceMonths: 72, street: "3rd Floor, 41 Tooley Street", place: { outcode: "SE1" },
    deliverySites: [
      { label: "Midlands install store", street: "Unit 2, Heartlands Park", place: { outcode: "B5" }, notes: "Fonts for venue rollouts are held here before install." },
      { label: "Northern install store", street: "Unit 7, Trafford Point", place: { outcode: "M4" }, notes: "Forklift on site. Call 30 minutes ahead." },
    ],
    contacts: [
      { name: "Olivia Bennett", title: "Trade Marketing Manager", role: "buyer", approve: true },
      { name: "James Whitaker", title: "Dispense Quality Manager", role: "technical", approve: true },
      { name: "Nadia Rahman", title: "Procurement Executive", role: "buyer" },
      { name: "Peter Lowe", title: "Finance Controller", role: "finance", approve: true },
    ],
  },
  {
    id: "acc_northlight", name: "Northlight Cider Company", kind: "customer", sector: "brand-owner", terms: "30-days", onAccount: true, creditLimit: 35000,
    priceList: "pl_brand", manager: "tm_rachel", technical: "tm_mark", health: "at-risk", sinceMonths: 30, street: "Studio 5, Hatters Yard, Tariff Street", place: { outcode: "M1" },
    contacts: [
      { name: "Hannah Marsden", title: "On-trade Manager", role: "buyer", approve: true },
      { name: "Ryan Doherty", title: "Field Technician", role: "technical" },
    ],
  },
  {
    id: "acc_wildfell", name: "Wildfell Spirits & Seltzers", kind: "customer", sector: "brand-owner", terms: "30-days", onAccount: true, creditLimit: 18000,
    priceList: "pl_brand", manager: "tm_rachel", technical: "tm_mark", health: "steady", sinceMonths: 20, street: "The Old Exchange, 22 Boar Lane", place: { outcode: "LS1" },
    contacts: [
      { name: "Zara Ahmed", title: "Brand Activation Lead", role: "buyer", approve: true },
      { name: "Ben Illingworth", title: "Events Manager", role: "bar-manager" },
    ],
  },
  // ---------- Pub group: Mill Race Inns ----------
  {
    id: "acc_millrace", name: "Mill Race Inns", kind: "customer", sector: "pub-group", isGroup: true, terms: "30-days-eom", onAccount: true, creditLimit: 75000,
    priceList: "pl_pubgroup", manager: "tm_rachel", technical: "tm_mark", health: "strong", sinceMonths: 84, street: "Riverside House, Calder Park", place: { outcode: "WF1" },
    contacts: [
      { name: "Andrew Hirst", title: "Operations Director", role: "buyer", approve: true },
      { name: "Louise Dyson", title: "Group Finance Manager", role: "finance", approve: true },
    ],
  },
  {
    id: "acc_millrace_weavers", name: "The Weaver's Rest", kind: "customer", sector: "pub", parent: "acc_millrace", terms: "30-days-eom", onAccount: true,
    priceList: null, manager: null, health: "strong", sinceMonths: 84, street: "Wakefield Road, Lepton", place: { outcode: "HD8" },
    contacts: [{ name: "Jess Armitage", title: "General Manager", role: "bar-manager", approve: true }, { name: "Liam Kaye", title: "Cellar Manager", role: "technical" }],
  },
  {
    id: "acc_millrace_plough", name: "The Ploughshare", kind: "customer", sector: "pub", parent: "acc_millrace", terms: "30-days-eom", onAccount: true,
    priceList: null, manager: null, health: "steady", sinceMonths: 60, street: "Cold Bath Road", place: { outcode: "HG1" },
    contacts: [{ name: "Rob Thackray", title: "General Manager", role: "bar-manager", approve: true }],
  },
  {
    id: "acc_millrace_tollhouse", name: "The Old Toll House", kind: "customer", sector: "pub", parent: "acc_millrace", terms: "30-days-eom", onAccount: true,
    priceList: null, manager: null, health: "steady", sinceMonths: 48, street: "Micklegate", place: { outcode: "YO1" },
    contacts: [{ name: "Amy Scaife", title: "General Manager", role: "bar-manager", approve: true }],
  },
  {
    id: "acc_millrace_navigation", name: "The Navigation", kind: "customer", sector: "pub", parent: "acc_millrace", terms: "30-days-eom", onAccount: true,
    priceList: null, manager: null, health: "at-risk", sinceMonths: 14, street: "Canal Wharf", place: { outcode: "BD23" },
    contacts: [{ name: "Declan Moss", title: "General Manager", role: "bar-manager", approve: true }],
  },
  // ---------- Pub group: Tyne & Wear Taverns ----------
  {
    id: "acc_tyne", name: "Tyne & Wear Taverns", kind: "customer", sector: "pub-group", isGroup: true, terms: "30-days", onAccount: true, creditLimit: 45000,
    priceList: "pl_pubgroup", manager: "tm_fiona", technical: "tm_mark", health: "steady", sinceMonths: 66, street: "Milburn House, Dean Street", place: { outcode: "NE1" },
    contacts: [
      { name: "Gavin Charlton", title: "Estates Director", role: "buyer", approve: true },
      { name: "Kirsty Robson", title: "Purchasing Coordinator", role: "buyer" },
    ],
  },
  {
    id: "acc_tyne_quayside", name: "The Quayside Arms", kind: "customer", sector: "pub", parent: "acc_tyne", terms: "30-days", onAccount: true,
    priceList: null, manager: null, health: "steady", sinceMonths: 66, street: "Sandhill", place: { outcode: "NE1" },
    contacts: [{ name: "Paul Heslop", title: "General Manager", role: "bar-manager", approve: true }],
  },
  {
    id: "acc_tyne_colliery", name: "The Colliery", kind: "customer", sector: "pub", parent: "acc_tyne", terms: "30-days", onAccount: true,
    priceList: null, manager: null, health: "steady", sinceMonths: 40, street: "Claypath", place: { outcode: "DH1" },
    contacts: [{ name: "Leanne Pattison", title: "General Manager", role: "bar-manager", approve: true }],
  },
  {
    id: "acc_tyne_wheatsheaf", name: "The Wheatsheaf", kind: "customer", sector: "pub", parent: "acc_tyne", terms: "30-days", onAccount: true,
    priceList: null, manager: null, health: "steady", sinceMonths: 22, street: "High Street West", place: { outcode: "SR1" },
    contacts: [{ name: "Sam Elliott", title: "General Manager", role: "bar-manager", approve: true }],
  },
  // ---------- Pubs and bars ----------
  {
    id: "acc_fleece", name: "The Fleece & Firkin", kind: "customer", sector: "pub", terms: "14-days", onAccount: true, creditLimit: 6000,
    priceList: "pl_trade", manager: "tm_rachel", health: "steady", sinceMonths: 44, street: "Penny Street", place: { outcode: "LA1" },
    contacts: [{ name: "Martin Cowgill", title: "Licensee", role: "bar-manager", approve: true }],
  },
  {
    id: "acc_crown", name: "The Crown & Anchor", kind: "customer", sector: "pub", terms: "proforma", onAccount: false,
    priceList: "pl_trade", manager: "tm_daniel", health: "steady", sinceMonths: 9, street: "Water Street", place: { outcode: "L3" },
    contacts: [{ name: "Kerry Flanagan", title: "Licensee", role: "bar-manager", approve: true }, { name: "Joe Byrne", title: "Bar Supervisor", role: "bar-manager" }],
  },
  {
    id: "acc_canaltap", name: "The Canal Tap", kind: "customer", sector: "pub", terms: "14-days", onAccount: true, creditLimit: 8000,
    priceList: "pl_trade", manager: "tm_daniel", health: "strong", sinceMonths: 36, street: "Canal Street", place: { outcode: "M1" },
    contacts: [{ name: "Danny Morgan", title: "Owner", role: "buyer", approve: true }],
  },
  {
    id: "acc_kelpie", name: "The Kelpie Bar", kind: "customer", sector: "pub", terms: "14-days", onAccount: true, creditLimit: 7500,
    priceList: "pl_trade", manager: "tm_fiona", health: "steady", sinceMonths: 26, street: "Great Western Road", place: { outcode: "G12" },
    contacts: [{ name: "Ross McKenzie", title: "Bar Manager", role: "bar-manager", approve: true }],
  },
  {
    id: "acc_neontiger", name: "Neon Tiger", kind: "customer", sector: "pub", terms: "14-days", onAccount: true, creditLimit: 9000,
    priceList: "pl_trade", manager: "tm_rachel", health: "strong", sinceMonths: 18, street: "Call Lane", place: { outcode: "LS2" },
    contacts: [{ name: "Mia Kowalski", title: "Venue Manager", role: "bar-manager", approve: true }, { name: "Theo Grant", title: "Assistant Manager", role: "bar-manager" }],
  },
  {
    id: "acc_vault", name: "Vault Seventeen", kind: "customer", sector: "pub", terms: "14-days", onAccount: true, creditLimit: 10000,
    priceList: "pl_trade", manager: "tm_daniel", health: "steady", sinceMonths: 29, street: "Digbeth High Street", place: { outcode: "B5" },
    contacts: [{ name: "Aaron Bains", title: "Operations Manager", role: "buyer", approve: true }],
  },
  {
    id: "acc_hopscotch", name: "Hopscotch Taproom", kind: "customer", sector: "pub", terms: "14-days", onAccount: true, creditLimit: 7000,
    priceList: "pl_trade", manager: "tm_rachel", health: "steady", sinceMonths: 15, street: "Division Street", place: { outcode: "S1" },
    contacts: [{ name: "Chloe Staniforth", title: "Owner", role: "buyer", approve: true }],
  },
  // ---------- Restaurants ----------
  {
    id: "acc_saltember", name: "Salt & Ember", kind: "customer", sector: "restaurant", terms: "30-days", onAccount: true, creditLimit: 12000,
    priceList: "pl_hospitality", manager: "tm_daniel", health: "strong", sinceMonths: 24, street: "St John Street", place: { outcode: "EC1V" },
    contacts: [{ name: "Lucy Carrington", title: "Restaurant Director", role: "buyer", approve: true }, { name: "Marco Russo", title: "Bar Manager", role: "bar-manager" }],
  },
  {
    id: "acc_osteria", name: "Osteria Lupa", kind: "customer", sector: "restaurant", terms: "proforma", onAccount: false,
    priceList: "pl_trade", manager: "tm_daniel", health: "steady", sinceMonths: 6, street: "Brindleyplace", place: { outcode: "B1" },
    contacts: [{ name: "Giulia Ferraro", title: "Owner", role: "buyer", approve: true }],
  },
  {
    id: "acc_larder", name: "The Northern Larder", kind: "customer", sector: "restaurant", terms: "30-days", onAccount: true, creditLimit: 6000,
    priceList: "pl_hospitality", manager: "tm_rachel", health: "steady", sinceMonths: 33, street: "Ecclesall Road", place: { outcode: "S11" },
    contacts: [{ name: "Owen Marshall", title: "Head Chef and Owner", role: "buyer", approve: true }],
  },
  // ---------- Hotels ----------
  {
    id: "acc_coachworks", name: "The Coachworks Hotel", kind: "customer", sector: "hotel", terms: "30-days-eom", onAccount: true, creditLimit: 30000,
    priceList: "pl_hospitality", manager: "tm_daniel", technical: "tm_mark", health: "strong", sinceMonths: 58, street: "Lace Market Square", place: { outcode: "NG1" },
    contacts: [{ name: "Victoria Shaw", title: "Food and Beverage Manager", role: "buyer", approve: true }, { name: "Stuart Page", title: "Maintenance Manager", role: "technical" }],
  },
  {
    id: "acc_strayview", name: "Stray View Hotel", kind: "customer", sector: "hotel", terms: "30-days", onAccount: true, creditLimit: 15000,
    priceList: "pl_hospitality", manager: "tm_rachel", health: "steady", sinceMonths: 47, street: "West Park", place: { outcode: "HG1" },
    contacts: [{ name: "Katherine Ellis", title: "General Manager", role: "buyer", approve: true }],
  },
  {
    id: "acc_granitequay", name: "Granite Quay Hotel", kind: "customer", sector: "hotel", terms: "30-days", onAccount: true, creditLimit: 20000,
    priceList: "pl_hospitality", manager: "tm_fiona", technical: "tm_mark", health: "steady", sinceMonths: 31, street: "Union Street", place: { outcode: "AB10" },
    contacts: [{ name: "Alasdair Grant", title: "Bars Manager", role: "bar-manager", approve: true }],
  },
  // ---------- Export ----------
  {
    id: "acc_liffey", name: "Liffey Quarter Hotel", kind: "customer", sector: "hotel", terms: "30-days", onAccount: true, creditLimit: 25000,
    priceList: "pl_export", manager: "tm_fiona", technical: "tm_mark", health: "steady", sinceMonths: 42, street: "Wellington Quay", place: DUBLIN,
    contacts: [{ name: "Siobhan Kelly", title: "Beverage Director", role: "buyer", approve: true }, { name: "Conor Walsh", title: "Engineering Manager", role: "technical" }],
  },
  {
    id: "acc_rebelcity", name: "Rebel City Brewing Co", kind: "customer", sector: "brewery", terms: "30-days", onAccount: true, creditLimit: 20000,
    priceList: "pl_export", manager: "tm_fiona", technical: "tm_mark", health: "strong", sinceMonths: 27, street: "Lower Glanmire Road", place: CORK,
    contacts: [{ name: "Niamh O'Sullivan", title: "Head of Trade", role: "buyer", approve: true }],
  },
  {
    id: "acc_koperentap", name: "De Koperen Tap", kind: "customer", sector: "pub", terms: "proforma", onAccount: false,
    priceList: "pl_export", manager: "tm_fiona", health: "steady", sinceMonths: 11, street: "Reguliersdwarsstraat", place: AMSTERDAM,
    contacts: [{ name: "Joost de Vries", title: "Eigenaar (Owner)", role: "buyer", approve: true }],
  },
  {
    id: "acc_marina", name: "Marina Crescent Hospitality LLC", kind: "customer", sector: "hotel", terms: "30-days", onAccount: true, creditLimit: 50000,
    priceList: "pl_export", manager: "tm_fiona", technical: "tm_mark", health: "steady", sinceMonths: 19, street: "Al Seef Road, Bur Dubai", place: DUBAI,
    contacts: [{ name: "Rahul Menon", title: "Director of Food and Beverage", role: "buyer", approve: true }, { name: "Farah Haddad", title: "Procurement Manager", role: "buyer" }],
  },
  // ---------- Suppliers ----------
  {
    id: "sup_vireo", name: "Vireo Dispense Systems Ltd", kind: "supplier", sector: "manufacturer", terms: "60-days", onAccount: true,
    priceList: "pl_cost_vireo", manager: null, buyer: "tm_joanne", health: "strong", sinceMonths: 110, street: "Unit 12, Centrum 100", place: { outcode: "DE14" },
    contacts: [{ name: "Neil Chapman", title: "Key Account Manager", role: "sales", approve: true }, { name: "Emma Tolley", title: "Sales Administrator", role: "sales" }],
  },
  {
    id: "sup_glacier", name: "Glacierline Cooling Ltd", kind: "supplier", sector: "manufacturer", terms: "60-days", onAccount: true,
    priceList: "pl_cost_glacier", manager: null, buyer: "tm_joanne", health: "strong", sinceMonths: 90, street: "Hortonwood 30", place: { outcode: "TF1" },
    contacts: [{ name: "Gareth Price", title: "UK Sales Manager", role: "sales", approve: true }, { name: "Sophie Lamb", title: "Customer Service Lead", role: "sales" }],
  },
  {
    id: "sup_northgas", name: "Northgas Controls Ltd", kind: "supplier", sector: "manufacturer", terms: "30-days-eom", onAccount: true,
    priceList: "pl_cost_northgas", manager: null, buyer: "tm_joanne", health: "steady", sinceMonths: 75, street: "Stafford Road Industrial Estate", place: { outcode: "WV1" },
    contacts: [{ name: "Adrian Webb", title: "Area Sales Manager", role: "sales", approve: true }],
  },
  {
    id: "sup_clearflow", name: "Clearflow Hygiene Supplies", kind: "supplier", sector: "distributor", terms: "30-days", onAccount: true,
    priceList: "pl_cost_clearflow", manager: null, buyer: "tm_joanne", health: "steady", sinceMonths: 62, street: "Winwick Quay", place: { outcode: "WA1" },
    contacts: [{ name: "Karen Rigby", title: "Trade Sales Manager", role: "sales", approve: true }, { name: "Josh Tickle", title: "Technical Sales", role: "technical" }],
  },
  {
    id: "sup_polarflex", name: "Polarflex Tubing Ltd", kind: "supplier", sector: "manufacturer", terms: "60-days", onAccount: true,
    priceList: "pl_cost_polarflex", manager: null, buyer: "tm_joanne", health: "steady", sinceMonths: 88, street: "Etruria Road", place: { outcode: "ST1" },
    contacts: [{ name: "Stephen Boulton", title: "Sales Director", role: "sales", approve: true }],
  },
  {
    id: "sup_brightbar", name: "Brightbar Fixtures Ltd", kind: "supplier", sector: "manufacturer", terms: "30-days-eom", onAccount: true,
    priceList: "pl_cost_brightbar", manager: null, buyer: "tm_joanne", health: "strong", sinceMonths: 70, street: "Whitebirk Industrial Estate", place: { outcode: "BB1" },
    contacts: [{ name: "Lisa Duckworth", title: "Account Manager", role: "sales", approve: true }, { name: "Harry Nuttall", title: "Design Lead", role: "technical" }],
  },
  {
    id: "sup_couplingworks", name: "Coupling Works Ltd", kind: "supplier", sector: "manufacturer", terms: "60-days", onAccount: true,
    priceList: "pl_cost_couplingworks", manager: null, buyer: "tm_joanne", health: "steady", sinceMonths: 101, street: "Hollinwood Business Centre", place: { outcode: "OL1" },
    contacts: [{ name: "Mike Schofield", title: "Sales Manager", role: "sales", approve: true }],
  },
  {
    id: "sup_tapmobile", name: "Tapmobile Europe B.V.", kind: "supplier", sector: "distributor", terms: "30-days", onAccount: true,
    priceList: "pl_cost_tapmobile", manager: null, buyer: "tm_joanne", health: "strong", sinceMonths: 48, street: "Wijnhaven 3", place: ROTTERDAM,
    contacts: [{ name: "Pieter Jansen", title: "Export Manager UK and Ireland", role: "sales", approve: true }],
  },
  {
    id: "sup_aquapure", name: "Aquapure Dispense Ltd", kind: "supplier", sector: "distributor", terms: "30-days", onAccount: true,
    priceList: "pl_cost_aquapure", manager: null, buyer: "tm_joanne", health: "steady", sinceMonths: 34, street: "Wheatley Hall Road", place: { outcode: "DN1" },
    contacts: [{ name: "Natalie Ward", title: "Channel Sales Manager", role: "sales", approve: true }],
  },
  {
    id: "sup_chillcase", name: "Chillcase Distribution Ltd", kind: "supplier", sector: "distributor", terms: "30-days", onAccount: true,
    priceList: "pl_cost_chillcase", manager: null, buyer: "tm_joanne", health: "steady", sinceMonths: 26, street: "Whitley Business Park", place: { outcode: "CV1" },
    contacts: [{ name: "Jordan Hayes", title: "Business Development Manager", role: "sales", approve: true }],
  },
  {
    id: "sup_emerald", name: "Emerald Dispense Distribution Ltd", kind: "supplier", sector: "distributor", terms: "30-days", onAccount: true,
    priceList: "pl_cost_emerald", manager: null, buyer: "tm_joanne", health: "steady", sinceMonths: 40, street: "Little Island Business Park", place: CORK,
    contacts: [{ name: "Eoin Murphy", title: "Sales Manager", role: "sales", approve: true }],
  },
];

type UkPostcode = { outcode: string; postcode: string; town: string; county: string; latitude: number; longitude: number };

function emailFor(name: string, company: string): string {
  const [first, ...rest] = name.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/);
  const domain = company
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/\b(ltd|llc|co|company|b\.?v\.?)\b/g, "")
    .replace(/[^a-z]/g, "")
    .slice(0, 22);
  return `${first}.${rest.join("")}@${domain}.example`;
}

function phoneFor(rng: Rng, country: string): string {
  if (country === "IE") return `+353 1 ${rng.int(400, 899)} ${rng.int(1000, 9999)}`;
  if (country === "NL") return `+31 20 ${rng.int(100, 899)} ${rng.int(1000, 9999)}`;
  if (country === "AE") return `+971 4 ${rng.int(200, 899)} ${rng.int(1000, 9999)}`;
  return `07700 900 ${String(rng.int(0, 999)).padStart(3, "0")}`;
}

export function seedPeople(rng: Rng, today: Date) {
  const pool = new Map<string, UkPostcode[]>();
  for (const p of ukPostcodes as UkPostcode[]) {
    pool.set(p.outcode, [...(pool.get(p.outcode) ?? []), p]);
  }
  const takeUk = (outcode: string): UkPostcode => {
    const list = pool.get(outcode);
    if (!list || list.length === 0) throw new Error(`No postcodes left for ${outcode}`);
    return list.shift()!;
  };

  const accounts: Account[] = [];
  const contacts: Contact[] = [];
  const addresses: Address[] = [];
  let addressSeq = 1;
  let contactSeq = 1;
  let companySeq = 0;

  const makeAddress = (accountId: string, label: string, street: string, place: PlaceRef, isDefault: boolean, notes: string | null): Address => {
    const n = rng.int(1, 140);
    const line1 = /^(unit|the|\d|riverside|milburn|weir|maltings|studio|3rd)/i.test(street) ? street : `${n} ${street}`;
    if ("outcode" in place) {
      const p = takeUk(place.outcode);
      return {
        id: `adr_${String(addressSeq++).padStart(3, "0")}`, accountId, label, line1, line2: null, town: p.town, county: p.county,
        postcode: p.postcode, country: "GB", latitude: p.latitude, longitude: p.longitude, isDefault, deliveryNotes: notes, approvalStatus: "approved",
      };
    }
    return {
      id: `adr_${String(addressSeq++).padStart(3, "0")}`, accountId, label, line1, line2: null, town: place.town, county: place.county,
      postcode: place.postcode, country: place.country, latitude: place.latitude, longitude: place.longitude, isDefault, deliveryNotes: notes, approvalStatus: "approved",
    };
  };

  for (const seed of ACCOUNT_SEEDS) {
    const venue = seed.kind === "customer" && ["pub", "restaurant", "hotel", "brewery"].includes(seed.sector);
    const notes = venue ? (seed.sector === "brewery" ? "Goods in via the brewery yard; forklift available weekdays." : "Deliveries to the cellar hatch; call the site on arrival.") : null;
    const main = makeAddress(seed.id, seed.kind === "supplier" ? "Head office" : seed.parent ? "Site" : seed.isGroup || seed.sector === "brand-owner" ? "Head office" : "Main address", seed.street, seed.place, true, notes);
    addresses.push(main);
    for (const site of seed.deliverySites ?? []) {
      addresses.push(makeAddress(seed.id, site.label, site.street, site.place, false, site.notes));
    }

    const country = main.country;
    const created = addDays(today, -Math.round(seed.sinceMonths * 30.4));
    companySeq++;
    accounts.push({
      id: seed.id,
      name: seed.name,
      kind: seed.kind,
      parentAccountId: seed.parent ?? null,
      isGroup: seed.isGroup ?? false,
      sector: seed.sector,
      companyNumber: seed.parent ? null : country === "GB" ? String(8_100_000 + companySeq * 37_411).padStart(8, "0") : null,
      vatNumber: seed.parent ? null : country === "GB" ? `GB ${String(310_000_000 + companySeq * 4_127_331).slice(0, 3)} ${String(4000 + companySeq * 97).slice(0, 4)} ${String(10 + companySeq).slice(-2)}` : country === "IE" ? `IE${3_200_000 + companySeq * 311}W` : country === "NL" ? `NL${String(850_000_000 + companySeq * 1_337)}B01` : `TRN 100${String(200_000_000 + companySeq * 7_919)}`,
      paymentTerms: seed.terms,
      creditLimit: seed.kind === "customer" && !seed.parent && seed.onAccount && seed.creditLimit ? { amount: seed.creditLimit * 100, currency: "GBP" } : null,
      onAccount: seed.onAccount,
      priceListId: seed.priceList,
      billingAddressId: main.id,
      accountManagerId: seed.manager,
      technicalContactId: seed.technical ?? null,
      buyerId: seed.buyer ?? null,
      relationshipHealth: seed.health,
      lastContactAt: isoDateTime(addDays(today, -rng.int(1, 12)), rng.int(8, 16), rng.pick([0, 15, 30, 45])),
      createdAt: isoDateTime(created, 10),
      updatedAt: isoDateTime(addDays(today, -rng.int(5, 60)), 11),
      pendingChanges: [],
    });

    seed.contacts.forEach((c, i) => {
      contacts.push({
        id: `con_${String(contactSeq++).padStart(3, "0")}`,
        accountId: seed.id,
        name: c.name,
        title: c.title,
        email: emailFor(c.name, seed.parent ? ACCOUNT_SEEDS.find((a) => a.id === seed.parent)!.name : seed.name),
        phone: phoneFor(rng, country),
        role: c.role,
        isPrimary: i === 0,
        canApprove: c.approve ?? false,
        approvalStatus: "approved",
      });
    });
  }

  return { team: BREWFITT_TEAM, accounts, contacts, addresses };
}
