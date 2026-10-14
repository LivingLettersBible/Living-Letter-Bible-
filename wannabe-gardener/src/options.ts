export interface StyleOption {
  id: string;
  name: string;
  blurb: string;
  colors: [string, string, string];
}

export const STYLES: StyleOption[] = [
  { id: "English cottage garden", name: "Cottage", blurb: "Romantic, overflowing borders", colors: ["#e8a0b4", "#b9a3e3", "#8fb573"] },
  { id: "Japanese zen garden", name: "Japanese Zen", blurb: "Moss, stone and calm", colors: ["#6b8f5e", "#a9a59a", "#c94f3d"] },
  { id: "Modern minimalist garden", name: "Modern", blurb: "Clean lines, grasses, concrete", colors: ["#3d4a3f", "#b8bdb5", "#d9cbb0"] },
  { id: "Mediterranean garden", name: "Mediterranean", blurb: "Olive, lavender, terracotta", colors: ["#8a9a5b", "#9c88c4", "#c8734a"] },
  { id: "Lush tropical garden", name: "Tropical", blurb: "Big leaves, bold colour", colors: ["#2f7d4a", "#f2a541", "#d6457a"] },
  { id: "Desert xeriscape garden", name: "Desert Xeriscape", blurb: "Drought-proof succulents", colors: ["#c9a26b", "#7ea18a", "#e07a5f"] },
  { id: "Native wildflower meadow", name: "Wildflower Meadow", blurb: "Pollinator heaven", colors: ["#f2c14e", "#7aa95c", "#8e7cc3"] },
  { id: "Edible kitchen garden (potager)", name: "Kitchen Garden", blurb: "Grow what you eat", colors: ["#5f9e4a", "#e4572e", "#f3c969"] },
  { id: "Woodland shade garden", name: "Woodland Shade", blurb: "Ferns, hostas, dappled light", colors: ["#3e6b48", "#9cbf8a", "#c7b8e0"] },
  { id: "Boho balcony jungle", name: "Boho Jungle", blurb: "Pots, trailing vines, cosy", colors: ["#7c9a5c", "#d9a066", "#b05f4a"] },
];

export const SPACES = ["Backyard", "Front yard", "Balcony", "Patio / courtyard", "Rooftop", "Side yard", "Indoor / sunroom"];
export const SUN = ["Not sure — guess from photo", "Full sun (6+ hrs)", "Part sun (3-6 hrs)", "Shade (<3 hrs)"];
export const MAINTENANCE = ["Barely any — I'm busy", "Low — an hour a week", "Medium — I want a hobby", "High — I'm all in"];
export const BUDGETS = ["Under $250", "Around $500", "Around $1,500", "Around $5,000", "Sky's the limit"];
