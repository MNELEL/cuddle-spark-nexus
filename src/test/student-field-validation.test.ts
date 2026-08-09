import { describe, expect, it } from "vitest";
import {
  joinName,
  phoneHref,
  splitFullName,
  validateBirthDate,
  validateNationalId,
  validatePhone,
  whatsappHref,
} from "@/lib/student-field-validation";

describe("student-field-validation", () => {
  describe("validateNationalId", () => {
    it("accepts empty and 5-9 digit values", () => {
      expect(validateNationalId("")).toBeNull();
      expect(validateNationalId("   ")).toBeNull();
      expect(validateNationalId("12345")).toBeNull();
      expect(validateNationalId("123456789")).toBeNull();
      expect(validateNationalId("12-345-678")).toBeNull();
    });
    it("rejects too short / too long", () => {
      expect(validateNationalId("1234")).toMatch(/5-9/);
      expect(validateNationalId("1234567890")).toMatch(/5-9/);
    });
  });

  describe("validatePhone", () => {
    it("accepts empty and Israeli local numbers", () => {
      expect(validatePhone("")).toBeNull();
      expect(validatePhone("050-1234567")).toBeNull();
      expect(validatePhone("021234567")).toBeNull();
    });
    it("rejects wrong length or missing leading zero", () => {
      expect(validatePhone("12345678")).toMatch(/9-10/);
      expect(validatePhone("05012345678")).toMatch(/9-10/);
      expect(validatePhone("501234567")).toMatch(/0/);
    });
  });

  describe("validateBirthDate", () => {
    it("accepts empty and valid ISO dates in range", () => {
      expect(validateBirthDate("")).toBeNull();
      expect(validateBirthDate("2015-12-12")).toBeNull();
    });
    it("rejects bad format, impossible dates and out-of-range years", () => {
      expect(validateBirthDate("12/12/2015")).toMatch(/YYYY-MM-DD/);
      expect(validateBirthDate("2015-13-45")).toBeTruthy();
      expect(validateBirthDate("1980-01-01")).toMatch(/טווח/);
      expect(validateBirthDate(`${new Date().getFullYear() + 1}-01-01`)).toMatch(/טווח/);
    });
  });

  describe("phone links", () => {
    it("returns digits only, or null when too short", () => {
      expect(phoneHref("050-123-4567")).toBe("0501234567");
      expect(phoneHref("1234")).toBeNull();
      expect(phoneHref(null)).toBeNull();
    });
    it("builds an E.164 WhatsApp link", () => {
      expect(whatsappHref("050-1234567")).toBe("https://wa.me/972501234567");
      expect(whatsappHref("972501234567")).toBe("https://wa.me/972501234567");
      expect(whatsappHref("12")).toBeNull();
    });
  });

  describe("name helpers", () => {
    it("splits on the first word", () => {
      expect(splitFullName("שמואל לוי")).toEqual({ first_name: "שמואל", last_name: "לוי" });
      expect(splitFullName("  יוסי   בן   דוד ")).toEqual({ first_name: "יוסי", last_name: "בן דוד" });
      expect(splitFullName("יוסי")).toEqual({ first_name: "יוסי", last_name: "" });
      expect(splitFullName("")).toEqual({ first_name: "", last_name: "" });
    });
    it("joins while dropping empties", () => {
      expect(joinName("שמואל", "לוי")).toBe("שמואל לוי");
      expect(joinName("שמואל", null)).toBe("שמואל");
      expect(joinName(null, null)).toBe("");
    });
  });
});
