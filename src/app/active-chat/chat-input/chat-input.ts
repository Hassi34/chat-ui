import { CommonModule } from '@angular/common';
import { Component, OnDestroy, computed, signal } from '@angular/core';
import { input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TextFieldModule } from '@angular/cdk/text-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import * as pdfjsLib from 'pdfjs-dist/build/pdf';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

type SpeechRecognitionConstructor = new () => any;

interface SpeechRecognitionWindow extends Window {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
}

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  if (typeof pdfjsLib.GlobalWorkerOptions.cMapUrl !== 'string') {
    pdfjsLib.GlobalWorkerOptions.cMapUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/cmaps/';
    pdfjsLib.GlobalWorkerOptions.cMapPacked = true;
  }
  if (typeof pdfjsLib.GlobalWorkerOptions.standardFontDataUrl !== 'string') {
    pdfjsLib.GlobalWorkerOptions.standardFontDataUrl = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/5.4.296/standard_fonts/';
  }
} catch (error) {
  console.warn('Failed to configure pdf.js worker options', error);
}

interface ChatAttachment {
  name: string;
  content: string;
}

interface AttachmentError {
  name: string;
  message: string;
}

@Component({
  selector: 'app-chat-input',
  standalone: true,
  imports: [CommonModule, FormsModule, TextFieldModule, MatButtonModule, MatIconModule],
  templateUrl: './chat-input.html',
  styleUrl: './chat-input.scss',
})
export class ChatInput implements OnDestroy {

  readonly disabled = input(false);
  readonly sendMessage = output<string>();

  protected readonly draft = signal('');
  protected readonly attachments = signal<ChatAttachment[]>([]);
  protected readonly attachmentErrors = signal<AttachmentError[]>([]);
  protected readonly isReadingFile = signal(false);
  protected readonly speechSupported = signal(false);
  protected readonly isListening = signal(false);
  protected readonly hasAttachment = computed(() => {
    return this.attachments().length > 0;
  });
  protected readonly canSend = computed(() => {
    if (this.disabled() || this.isReadingFile()) {
      return false;
    }

    return this.draft().trim().length > 0 || this.attachments().length > 0;
  });

  private recognition: any = null;
  private speechBaseDraft = '';
  private shouldAutoSend = false;
  private mammothLib: any | null = null;

  public constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    const speechWindow = window as SpeechRecognitionWindow;
    const RecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;

    if (!RecognitionCtor) {
      return;
    }

    try {
      const recognition = new RecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;
      recognition.lang = navigator?.language ?? 'en-US';

      recognition.onstart = () => {
        this.isListening.set(true);
      };

      recognition.onend = () => {
        this.isListening.set(false);
        this.shouldAutoSend = false;
      };

      recognition.onerror = () => {
        this.isListening.set(false);
        this.shouldAutoSend = false;
      };

      recognition.onresult = (event: any) => {
        this.handleSpeechResult(event);
      };

      this.recognition = recognition;
      this.speechSupported.set(true);
    } catch (error) {
      console.warn('Speech recognition initialisation failed', error);
      this.recognition = null;
    }
  }

  protected handleDraftChange(value: string): void {
    this.draft.set(value);
  }

  protected async handleFileSelection(event: Event): Promise<void> {
    if (this.disabled()) {
      return;
    }

    const input = event.target as HTMLInputElement | null;
    const files = input?.files ? Array.from(input.files) : [];

    if (!files.length) {
      this.resetNativeFileInput(input ?? undefined);
      return;
    }

    this.isReadingFile.set(true);
    this.attachmentErrors.set([]);

    const existingAttachments = [...this.attachments()];
    const errors: AttachmentError[] = [];

    try {
      for (const file of files) {
        try {
          const content = await this.extractFileContent(file);

          if (!content) {
            errors.push({ name: file.name, message: 'Unable to extract readable text from the attachment.' });
            continue;
          }

          const trimmedContent = content.trim();

          if (!trimmedContent) {
            errors.push({ name: file.name, message: 'The attachment did not contain readable text.' });
            continue;
          }

          const nextAttachment: ChatAttachment = {
            name: file.name,
            content,
          };

          const existingIndex = existingAttachments.findIndex((attachment) => attachment.name === file.name);

          if (existingIndex >= 0) {
            existingAttachments[existingIndex] = nextAttachment;
          } else {
            existingAttachments.push(nextAttachment);
          }
        } catch (error) {
          console.warn('File processing failed', error);
          errors.push({ name: file.name, message: 'Unable to read the selected file.' });
        }
      }

      this.attachments.set(existingAttachments);
      this.attachmentErrors.set(errors);
    } finally {
      this.isReadingFile.set(false);
      this.resetNativeFileInput(input ?? undefined);
    }
  }

  protected removeAttachment(index: number): void {
    if (index < 0) {
      return;
    }

    const attachments = [...this.attachments()];

    if (index >= attachments.length) {
      return;
    }

    const [removed] = attachments.splice(index, 1);
    this.attachments.set(attachments);

    if (removed) {
      const remainingErrors = this.attachmentErrors().filter((error) => error.name !== removed.name);
      this.attachmentErrors.set(remainingErrors);
    } else if (!attachments.length) {
      this.attachmentErrors.set([]);
    }
  }

  protected clearAllAttachments(): void {
    this.attachments.set([]);
    this.attachmentErrors.set([]);
  }

  protected clearAttachments(fileInput?: HTMLInputElement): void {
    this.clearAllAttachments();
    this.resetNativeFileInput(fileInput);
    this.isReadingFile.set(false);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    if (event.isComposing) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      if (this.disabled()) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      this.submit();
    }
  }

  protected submit(): void {
    if (!this.canSend()) {
      return;
    }

    const parts: string[] = [];
    const textBody = this.draft().trim();

    if (textBody) {
      parts.push(textBody);
    }

    for (const attachment of this.attachments()) {
      const content = attachment.content;
      const trimmed = content.trim();

      if (!trimmed) {
        continue;
      }

      parts.push(`Attachment (${attachment.name}):\n${content}`);
    }

    const message = parts.join('\n\n');

    if (!message) {
      return;
    }

    this.sendMessage.emit(message);
    this.reset();
  }

  public prefillAndSubmit(message: string): void {
    const value = message.trim();
    if (!value || this.disabled()) {
      return;
    }

    this.draft.set(value);
    this.submit();
  }

  public reset(): void {
    this.draft.set('');
    this.clearAllAttachments();
  }

  protected toggleMic(): void {
    if (!this.recognition || this.disabled()) {
      return;
    }

    if (this.isListening()) {
      this.shouldAutoSend = false;

      try {
        this.recognition.stop();
      } catch (error) {
        console.warn('Speech recognition stop failed', error);
      }

      return;
    }

    this.speechBaseDraft = this.draft().trim();
    this.shouldAutoSend = true;

    try {
      this.recognition.start();
    } catch (error) {
      this.shouldAutoSend = false;
      this.isListening.set(false);
      console.warn('Speech recognition start failed', error);
    }
  }

  public ngOnDestroy(): void {
    if (!this.recognition) {
      return;
    }

    try {
      this.recognition.onresult = null;
      this.recognition.onend = null;
      this.recognition.onstart = null;
      this.recognition.onerror = null;
      this.recognition.stop();
    } catch (error) {
      console.warn('Speech recognition cleanup failed', error);
    }

    this.recognition = null;
  }

  private resetNativeFileInput(input?: HTMLInputElement): void {
    if (!input) {
      return;
    }

    try {
      input.value = '';
    } catch (error) {
      console.warn('Resetting file input failed', error);
    }
  }

  private handleSpeechResult(event: any): void {
    if (!event?.results) {
      return;
    }

    let interimTranscript = '';
    let finalTranscript = '';

    for (let index = event.resultIndex ?? 0; index < event.results.length; index++) {
      const result = event.results[index];
      const transcript = result?.[0]?.transcript?.trim();

      if (!transcript) {
        continue;
      }

      if (result.isFinal) {
        finalTranscript += `${transcript} `;
      } else {
        interimTranscript += `${transcript} `;
      }
    }

    const base = this.speechBaseDraft ? `${this.speechBaseDraft} ` : '';
    const workingDraft = (base + (finalTranscript || interimTranscript)).trim();

    if (workingDraft) {
      this.draft.set(workingDraft);
    }

    if (!finalTranscript.trim()) {
      return;
    }

    const message = (base + finalTranscript).trim();

    if (message) {
      this.draft.set(message);

      if (this.shouldAutoSend && !this.disabled()) {
        setTimeout(() => this.submit(), 0);
      }
    }

    this.speechBaseDraft = '';
    this.shouldAutoSend = false;
  }

  private async extractFileContent(file: File): Promise<string | null> {
    const fileName = file.name.toLowerCase();

    if (file.type === 'application/pdf' || fileName.endsWith('.pdf')) {
      return this.extractPdfText(file);
    }

    if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      return this.extractDocxText(file);
    }

    if (file.type.startsWith('text/') || this.isTextLikeExtension(fileName)) {
      return this.readFileAsText(file);
    }

    return this.readFileAsText(file);
  }

  private isTextLikeExtension(fileName: string): boolean {
    const textExtensions = ['.txt', '.md', '.json', '.yaml', '.yml', '.xml', '.csv', '.log', '.html', '.htm'];
    return textExtensions.some((extension) => fileName.endsWith(extension));
  }

  private readFileAsText(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const reader = new FileReader();

      reader.onload = () => {
        resolve(typeof reader.result === 'string' ? reader.result : null);
      };

      reader.onerror = () => resolve(null);
      reader.onabort = () => resolve(null);

      try {
        reader.readAsText(file);
      } catch (error) {
        console.warn('readAsText failed', error);
        resolve(null);
      }
    });
  }

  private async extractDocxText(file: File): Promise<string | null> {
    try {
      const mammoth = await this.loadMammoth();

      if (!mammoth?.extractRawText) {
        console.warn('mammoth is unavailable for DOCX extraction');
        return null;
      }

      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      const text = typeof result?.value === 'string' ? result.value : '';

      return text.trim() || null;
    } catch (error) {
      console.warn('DOCX text extraction failed', error);
      return null;
    }
  }

  private async loadMammoth(): Promise<any> {
    if (this.mammothLib) {
      return this.mammothLib;
    }

    try {
      const module = await import('mammoth/mammoth.browser');
      const mammoth = (module as any)?.default ?? module;

      if (mammoth?.extractRawText) {
        this.mammothLib = mammoth;
        return mammoth;
      }
    } catch (error) {
      console.warn('Failed to load mammoth library', error);
    }

    return null;
  }

  private async extractPdfText(file: File): Promise<string | null> {
    let loadingTask: any | null = null;
    let document: any | null = null;

    try {
      if (!pdfjsLib || typeof pdfjsLib.getDocument !== 'function') {
        console.warn('pdf.js is not available for PDF extraction');
        return null;
      }

      const buffer = await file.arrayBuffer();
      loadingTask = pdfjsLib.getDocument({
        data: new Uint8Array(buffer),
        useSystemFonts: true,
        enableXfa: true,
        disableAutoFetch: false,
        standardFontDataUrl: pdfjsLib.GlobalWorkerOptions?.standardFontDataUrl,
        cMapUrl: pdfjsLib.GlobalWorkerOptions?.cMapUrl,
        cMapPacked: pdfjsLib.GlobalWorkerOptions?.cMapPacked ?? true,
      });

      document = await loadingTask.promise;

      const pageTexts: string[] = [];

      for (let pageIndex = 1; pageIndex <= document.numPages; pageIndex++) {
        const page = await document.getPage(pageIndex);
        const textContent = await page.getTextContent({
          normalizeWhitespace: true,
          includeMarkedContent: true,
          disableCombineTextItems: false,
        });

        const items = Array.isArray(textContent.items) ? textContent.items : [];

        const text = items
          .map((item: any) => {
            if (!item) {
              return '';
            }

            if (typeof item.str === 'string') {
              return item.str;
            }

            if (typeof item.text === 'string') {
              return item.text;
            }

            if (Array.isArray(item.items)) {
              return item.items
                .map((nested: any) => {
                  if (typeof nested?.str === 'string') {
                    return nested.str;
                  }

                  if (typeof nested?.text === 'string') {
                    return nested.text;
                  }

                  return '';
                })
                .join(' ');
            }

            return '';
          })
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();

        if (text) {
          pageTexts.push(text);
        }
      }

      return pageTexts.length ? pageTexts.join('\n\n') : null;
    } catch (error) {
      console.warn('PDF text extraction failed', error);
      return null;
    } finally {
      if (document) {
        try {
          if (typeof document.cleanup === 'function') {
            document.cleanup();
          }
        } catch (cleanupError) {
          console.warn('pdf.js cleanup failed', cleanupError);
        }

        try {
          if (typeof document.destroy === 'function') {
            document.destroy();
          }
        } catch (destroyError) {
          console.warn('pdf.js destroy failed', destroyError);
        }
      }

      if (loadingTask && typeof loadingTask.destroy === 'function') {
        try {
          await loadingTask.destroy();
        } catch (taskError) {
          console.warn('pdf.js loading task destroy failed', taskError);
        }
      }
    }
  }
}
