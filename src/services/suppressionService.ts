// suppressionService.ts
export class SuppressionService {
  private dncSet: Set<string> = new Set();

  constructor(initialDncList: string[] = []) {
    initialDncList.forEach((num) => this.dncSet.add(this.normalizePhoneNumber(num)));
  }

  /**
   * Normalizes to 10-digit format by stripping non-digits and leading '1'.
   */
  private normalizePhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 11 && digits.startsWith('1')) {
      return digits.substring(1);
    }
    return digits;
  }

  public isSuppressionMatched(phoneNumber: string): boolean {
    const clean = this.normalizePhoneNumber(phoneNumber);
    return this.dncSet.has(clean);
  }

  /**
   * Stub for future TCPA compliance rules (e.g., time-of-day, consent checks).
   */
  public isTCPACompliant<T extends { phone: string }>(lead: T): boolean {
    // Implement specific TCPA logic here
    return true;
  }

  public filterCompliantLeads<T extends { phone: string }>(leads: T[]): T[] {
    return leads.filter((lead) => !this.isSuppressionMatched(lead.phone) && this.isTCPACompliant(lead));
  }
}
