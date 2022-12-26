import type { Range } from "vscode-languageserver-textdocument";

export class Elem {
  private char: string;
  private range: Range | null;
  constructor(char: string, range: Range | null) {
    this.char = char;
    this.range = range;
  }
  public getChar(): string {
    return this.char;
  }
  public getRange(): Range {
    if (this.range === null) {
      throw new Error("range is null");
    }
    return this.range;
  }
}

export class Operation {
  private stateName: Elem;
  private tape: Elem[];
  private move: Elem[];
  constructor(stateName: Elem, tape: Elem[], move: Elem[]) {
    this.stateName = stateName;
    this.tape = tape;
    this.move = move;
  }
  public getStateName(): Elem {
    return this.stateName;
  }
  public getTape(): Elem[] {
    return this.tape;
  }
  public getMove(): Elem[] {
    return this.move;
  }
}

export class State {
  private name: string;
  private operations = new Map<string, Operation>();
  private range: Range;
  constructor(name: string, range: Range) {
    this.name = name;
    this.range = range;
  }
  public getName(): string {
    return this.name;
  }
  public addOperation(cond: Elem, ope: Operation): void {
    this.operations.set(cond.getChar(), ope);
  }
  public getOperation(cond: Elem): Operation | undefined {
    return this.operations.get(cond.getChar());
  }
  public getOperations(): Map<string, Operation> {
    return this.operations;
  }
  public getRange(): Range {
    return this.range;
  }
}
