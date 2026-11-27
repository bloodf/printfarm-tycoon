import type { ProductId } from './products'

export const FIRST_NAMES = [
  'Lisa', 'Marco', 'Aiko', 'Daniel', 'Priya', 'Tom', 'Sofia', 'Kenji', 'Emma', 'Lucas', 'Nora', 'Omar', 'Chloe',
  'Felix', 'Hana', 'Jonas', 'Maya', 'Ravi', 'Zoe', 'Ben', 'Ines', 'Theo', 'Ava', 'Leo', 'Mila', 'Sam', 'Yara',
]
export const LAST_NAMES = [
  'Meyer', 'Rossi', 'Tanaka', 'Walsh', 'Patel', 'Novak', 'Garcia', 'Sato', 'Brown', 'Silva', 'Berg', 'Haddad',
  'Dubois', 'Klein', 'Kim', 'Larsen', 'Cohen', 'Singh', 'Evans', 'Costa', 'Moreau', 'Fischer', 'Lee', 'Ward',
]
export const CITIES = [
  'Portland, OR', 'Austin, TX', 'Denver, CO', 'Madison, WI', 'Raleigh, NC', 'Boise, ID', 'Tucson, AZ',
  'Columbus, OH', 'Salem, MA', 'Fresno, CA', 'Omaha, NE', 'Reno, NV', 'Spokane, WA', 'Tampa, FL',
]

/** Custom-request email templates. {product} and {color} are filled in. */
export const REQUEST_TEMPLATES: { productId: ProductId; subject: string; body: string }[] = [
  { productId: 'gear', subject: 'Replacement knob for my coffee grinder?', body: "Hi!\n\nThe adjustment knob on my coffee grinder snapped and the manufacturer wants $40 for a new one. I found a model online that fits. Could you print it in {color}? I'd need it by the end of the week.\n\nThanks so much," },
  { productId: 'helmet', subject: 'Cosplay commission: helmet for a convention', body: "Hello!\n\nI'm going to a convention soon and I need a helmet shell printed. I'll do the sanding and painting myself. {color} is fine since I'm painting it.\n\nCan you do it? What would it cost?\n\nCheers," },
  { productId: 'planter', subject: 'Planters for my café', body: "Hi there,\n\nI run a small café and would love a hex planter in {color} for the counter. If it looks good I'll order more for the tables!\n\nBest," },
  { productId: 'dragon', subject: 'Birthday present for my son', body: "Hey!\n\nMy son turns 7 next week and he's obsessed with dragons. Could you print one of the articulated dragons in {color}? It would make his day.\n\nThank you!" },
  { productId: 'phone_stand', subject: 'Bulk phone stands?', body: "Hello,\n\nWe're a small marketing agency and we'd like a {color} phone stand as a test before a possible bulk order for our clients.\n\nRegards," },
  { productId: 'vase', subject: 'Wedding table decoration', body: "Hi!\n\nI'm planning my sister's wedding and saw your spiral vases. Could you make one in {color} as a sample? If the bride likes it we might need 12!\n\nxx" },
]

export const REVIEW_TEXT: Record<number, string[]> = {
  5: ['Perfect print, super fast shipping!', 'Exactly as pictured. Will order again!', 'Amazing quality, you can barely see the layers.', 'Arrived early and well packed. 10/10'],
  4: ['Nice print, small stringing but happy.', 'Good quality, shipping took a bit.', 'Great value for money.'],
  3: ['OK print. Took longer than expected.', 'Fine, but the packaging was minimal.', 'Decent, some visible layer lines.'],
  2: ['Arrived late and the print has flaws.', 'Not great. The layers are shifted.', 'Disappointed with the quality.'],
  1: ['Print was defective. Want a refund.', 'Terrible. Broken and late.', 'Never again.'],
}

export const TIPS = [
  'Use ▶▶ 8× on the toolbar to fast-forward while printers are busy.',
  'Wi-Fi printers start straight from the Slicer. USB printers must be started at the machine.',
  'Spaghetti happens! Check your printers regularly, or buy printers with a camera.',
  'The courier comes at 17:00. Boxes must be on the Outbox shelf before then.',
  'Match the filament colour to the order. Customers notice.',
  'Fine quality takes longer but earns better reviews.',
  'Deliveries from the Shop arrive the next morning at 08:30.',
  'ABS warps on open printers. Use an enclosed machine.',
]
