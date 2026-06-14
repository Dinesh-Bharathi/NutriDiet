export class PlaceholderRegistry {
  constructor(initialPlaceholders = []) {
    this.placeholders = new Map(initialPlaceholders.map((p) => [p.key, p]));
  }

  register(placeholder) {
    this.placeholders.set(placeholder.key, placeholder);
  }

  get(key) {
    return this.placeholders.get(key);
  }

  getAll() {
    return Array.from(this.placeholders.values());
  }

  getByCategory(category) {
    return this.getAll().filter((p) => p.category === category);
  }

  getCategories() {
    return Array.from(new Set(this.getAll().map((p) => p.category)));
  }

  /**
   * Replaces all placeholder keys in the input string/HTML with corresponding values.
   *
   * @param {string} text - The template text or HTML string
   * @param {Record<string, string>} [customValues] - Optional map of key -> custom override values
   * @returns {string} Interpolated text
   */
  interpolate(text, customValues = {}) {
    if (!text) return "";
    let result = text;
    for (const [key, placeholder] of this.placeholders.entries()) {
      const value = customValues[key] ?? placeholder.sampleValue ?? "";
      result = result.split(key).join(value);
    }
    return result;
  }
}

export const defaultPlaceholders = [
  // Clinic Info
  {
    key: "{{clinic_name}}",
    label: "Clinic Name",
    category: "clinic",
    description: "The name of your clinic or practice",
    sampleValue: "Aura Wellness Clinic",
  },
  {
    key: "{{clinic_email}}",
    label: "Clinic Email",
    category: "clinic",
    description: "Contact email address of the clinic",
    sampleValue: "contact@aurawellness.com",
  },
  {
    key: "{{clinic_phone}}",
    label: "Clinic Phone",
    category: "clinic",
    description: "Phone number of the clinic",
    sampleValue: "+1 (555) 019-2834",
  },
  {
    key: "{{clinic_address}}",
    label: "Clinic Address",
    category: "clinic",
    description: "Physical address of the clinic",
    sampleValue: "742 Evergreen Terrace, Springfield",
  },
  // Patient Info
  {
    key: "{{patient_name}}",
    label: "Patient Name",
    category: "patient",
    description: "Full name of the patient/client",
    sampleValue: "Jane Doe",
  },
  {
    key: "{{patient_email}}",
    label: "Patient Email",
    category: "patient",
    description: "Email address of the patient/client",
    sampleValue: "jane.doe@example.com",
  },
  {
    key: "{{patient_phone}}",
    label: "Patient Phone",
    category: "patient",
    description: "Phone number of the patient/client",
    sampleValue: "+1 (555) 014-9988",
  },
  {
    key: "{{patient_dob}}",
    label: "Patient Date of Birth",
    category: "patient",
    description: "Date of birth of the patient/client",
    sampleValue: "October 12, 1990",
  },
  {
    key: "{{patient_gender}}",
    label: "Patient Gender",
    category: "patient",
    description: "Gender of the patient/client",
    sampleValue: "Female",
  },
  {
    key: "{{patient_age}}",
    label: "Patient Age",
    category: "patient",
    description: "Age of the patient/client in years",
    sampleValue: "32",
  },
  {
    key: "{{patient_height}}",
    label: "Patient Height",
    category: "patient",
    description: "Height of the patient/client",
    sampleValue: "175 cm",
  },
  {
    key: "{{patient_weight}}",
    label: "Patient Weight",
    category: "patient",
    description: "Current body weight of the patient/client",
    sampleValue: "82 kg",
  },
  {
    key: "{{patient_goal}}",
    label: "Patient Goal",
    category: "patient",
    description: "Primary health or nutrition goal of the patient/client",
    sampleValue: "Fat Loss",
  },
  // Document Info
  {
    key: "{{document_date}}",
    label: "Document Date",
    category: "document",
    description: "The date the document was generated",
    sampleValue: "June 13, 2026",
  },
  {
    key: "{{author_name}}",
    label: "Author Name",
    category: "document",
    description: "Name of the dietitian or staff who generated the document",
    sampleValue: "Dr. Sarah Jenkins, RD",
  },
  {
    key: "{{document_title}}",
    label: "Document Title",
    category: "document",
    description: "The title of the generated document",
    sampleValue: "Personalized Diet & Nutrition Plan",
  },
  {
    key: "{{page}}",
    label: "Page Number",
    category: "document",
    description: "The current page number of the document",
    sampleValue: "1",
  },
  {
    key: "{{total_pages}}",
    label: "Total Pages",
    category: "document",
    description: "The total number of pages in the document",
    sampleValue: "3",
  },
  {
    key: "{{generated_at}}",
    label: "Generated At",
    category: "document",
    description: "The date and time the PDF was generated",
    sampleValue: "June 13, 2026, 07:51 PM",
  },
  // Assets Info
  {
    key: "{{clinic_logo}}",
    label: "Clinic Logo",
    category: "assets",
    description: "Renders the currently uploaded clinic branding logo in the document flow",
    sampleValue: "[Clinic Logo Image]",
  },
  {
    key: "{{watermark}}",
    label: "Watermark",
    category: "assets",
    description: "Renders the currently configured watermark image behind all text content",
    sampleValue: "[Watermark]",
  },
];

export const placeholderRegistry = new PlaceholderRegistry(defaultPlaceholders);

export default placeholderRegistry;
