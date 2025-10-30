declare module 'mammoth/mammoth.browser' {
  interface MammothMessage {
    type: string;
    message: string;
  }

  interface MammothResult<T = string> {
    value: T;
    messages: MammothMessage[];
  }

  interface MammothOptions {
    arrayBuffer: ArrayBuffer;
  }

  interface Mammoth {
    extractRawText(options: MammothOptions): Promise<MammothResult<string>>;
    convertToHtml(options: MammothOptions): Promise<MammothResult<string>>;
  }

  const mammoth: Mammoth;
  export default mammoth;
}
