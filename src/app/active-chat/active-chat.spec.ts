import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ActiveChat } from './active-chat';
import { ChatAiService } from '../services/chat-ai.service';

describe('ActiveChat', () => {
  let component: ActiveChat;
  let fixture: ComponentFixture<ActiveChat>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveChat],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ChatAiService,
          useValue: {
            sendMessage: () => of({ reply: 'Hello there!' })
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveChat);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
