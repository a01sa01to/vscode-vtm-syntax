export class Operation {
  private stateName: string;
  private tape: string[];
  private move: string[];
  constructor(stateName: string, tape: string[], move: string[]) {
    this.stateName = stateName;
    this.tape = tape;
    this.move = move;
  }
  public getStateName(): string {
    return this.stateName;
  }
  public getTape(): string[] {
    return this.tape;
  }
  public getMove(): string[] {
    return this.move;
  }
}

export class State {
  private name: string;
  private operations = new Map<string[], Operation>();
  constructor(name: string) {
    this.name = name;
  }
  public getName(): string {
    return this.name;
  }
  public addOperation(cond: string[], ope: Operation): boolean {
    if (this.operations.has(cond)) {
      return false;
    }
    this.operations.set(cond, ope);
    return true;
  }
}
