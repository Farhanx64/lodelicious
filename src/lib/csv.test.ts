import { describe, expect, it } from "vitest";

import { parseCsv, parseCsvRecords } from "./csv";

describe("parseCsv", () => {
  it("handles quotes, doubled quotes, embedded commas and CRLF", () => {
    const text = 'a,b,c\r\n1,"x, y","say ""hi"""\r\n2,,"multi\nline"\n';
    expect(parseCsv(text)).toEqual([
      ["a", "b", "c"],
      ["1", "x, y", 'say "hi"'],
      ["2", "", "multi\nline"],
    ]);
  });

  it("keeps a trailing empty field", () => {
    expect(parseCsv("a,b\n1,\n")).toEqual([
      ["a", "b"],
      ["1", ""],
    ]);
  });

  it("rejects an unterminated quote", () => {
    expect(() => parseCsv('a\n"oops')).toThrow(SyntaxError);
  });
});

describe("parseCsvRecords", () => {
  it("maps rows to header keys and rejects ragged rows", () => {
    expect(parseCsvRecords("ref,price\nC01,1000\n")).toEqual([{ ref: "C01", price: "1000" }]);
    expect(() => parseCsvRecords("ref,price\nC01\n")).toThrow(/expected 2/);
  });
});
