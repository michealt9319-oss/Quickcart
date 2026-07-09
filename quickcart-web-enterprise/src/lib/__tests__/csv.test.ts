import { buildCsvContent } from "../csv";

describe("buildCsvContent", () => {
  it("joins headers and rows with commas and newlines", () => {
    const csv = buildCsvContent(["Name", "Price"], [["Rice", 5000], ["Milk", 1200]]);
    expect(csv).toBe("Name,Price\nRice,5000\nMilk,1200");
  });

  it("quotes and escapes a field containing a comma", () => {
    const csv = buildCsvContent(["Note"], [["hello, world"]]);
    expect(csv).toBe('Note\n"hello, world"');
  });

  it("doubles embedded quotes inside a quoted field", () => {
    const csv = buildCsvContent(["Note"], [['She said "hi"']]);
    expect(csv).toBe('Note\n"She said ""hi"""');
  });

  it("quotes a field containing a newline", () => {
    const csv = buildCsvContent(["Note"], [["line1\nline2"]]);
    expect(csv).toBe('Note\n"line1\nline2"');
  });

  it("handles an empty row set", () => {
    const csv = buildCsvContent(["A", "B"], []);
    expect(csv).toBe("A,B");
  });
});
