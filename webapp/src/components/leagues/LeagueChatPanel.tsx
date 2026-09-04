import { useEffect, useMemo, useRef, useState, type UIEvent } from 'react';

import { ArrowDown, Ban, Flag, MessagesSquare, Send, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Button, Card, Modal, Notice, Skeleton } from '@/components/ui';
import { SUPPORT_EMAIL } from '@/constants/disclosure';
import { getCosmeticItem } from '@/constants/cosmetics';
import { useUserCosmetics } from '@/hooks/use-cosmetics';
import {
  MESSAGE_REPORT_REASONS,
  useAcceptChatTermsMutation,
  useBlockUserMutation,
  useChatModerationStatus,
  useReportMessageMutation,
  type MessageReportReason,
} from '@/hooks/use-content-moderation';
import {
  useLeagueChat,
  useSendLeagueChatMessage,
  useSendLeagueChatSticker,
  type LeagueChatMessage,
  type SharedBetMetadata,
  type StickerMessageMetadata,
} from '@/hooks/use-league-chat';
import type { LeagueDetail } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { getChatContentFilterMessage } from '@/lib/content-filter';
import { getLeagueMemberPrimaryName } from '@/lib/league-member-display';
import { ROUTES } from '@/lib/routes';
import type { EquippedCosmeticsByCategory, Json, LeagueMemberRow } from '@/types/database';

import { Badge } from './Badge';
import { ChatStickerPreview, CosmeticAvatar } from './cosmetic-art';
import { FieldTextarea } from './FieldTextarea';
import { SharedBetCard } from './SharedBetCard';

type ChatActionTarget = {
  displayName: string;
  message: LeagueChatMessage;
};

function isRecord(value: Json): value is Record<string, Json> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSharedBetMetadata(value: Json): value is SharedBetMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.amount === 'number' &&
    typeof value.odds === 'number' &&
    typeof value.potentialReward === 'number' &&
    typeof value.weekNumber === 'number' &&
    typeof value.betType === 'string' &&
    Array.isArray(value.legs)
  );
}

function isStickerMetadata(value: Json): value is StickerMessageMetadata {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.stickerId === 'string' && typeof value.stickerName === 'string';
}

function getShortTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(
    new Date(value),
  );
}

type ChatInsertErrorAction = 'ban' | 'filter' | 'terms' | 'unknown';

/** Port of getChatInsertErrorAction — same patterns, same player-facing copy. */
function getChatInsertErrorAction(error: unknown): {
  action: ChatInsertErrorAction;
  message: string;
} {
  const rawMessage = error instanceof Error ? error.message : String(error);

  if (/accept the chat terms|chat terms before posting/i.test(rawMessage)) {
    return { action: 'terms', message: 'Accept the chat terms before posting.' };
  }

  if (/objectionable|banned term|please revise/i.test(rawMessage)) {
    return { action: 'filter', message: 'Remove objectionable language before sending.' };
  }

  if (/not allowed to post|chat banned|chat_banned/i.test(rawMessage)) {
    return { action: 'ban', message: 'This account is not allowed to post in chat.' };
  }

  return { action: 'unknown', message: rawMessage || 'Could not send message.' };
}

function ChatBubble({
  cosmetics,
  isMine,
  member,
  message,
  onOpenActions,
}: {
  cosmetics?: EquippedCosmeticsByCategory;
  isMine: boolean;
  member?: LeagueMemberRow;
  message: LeagueChatMessage;
  onOpenActions: (message: LeagueChatMessage, displayName: string) => void;
}) {
  const isSystem = message.message_type === 'system';
  const isBetShare = message.message_type === 'bet_share';
  const isSticker = message.message_type === 'sticker';
  const displayName = isSystem
    ? 'Action Arena'
    : getLeagueMemberPrimaryName(member, message.user, 'Player');
  const metadata = isSharedBetMetadata(message.metadata) ? message.metadata : null;
  const stickerMetadata = isStickerMetadata(message.metadata) ? message.metadata : null;

  if (isSystem) {
    return (
      <li className="flex justify-center px-2">
        <span className="max-w-[80%] rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-center text-[10px] font-black uppercase tracking-[0.14em] text-white/55">
          {message.body}
        </span>
      </li>
    );
  }

  return (
    <li className={cn('flex items-end gap-2', isMine ? 'justify-end' : 'justify-start')}>
      {!isMine ? <CosmeticAvatar cosmetics={cosmetics} name={displayName} size="sm" /> : null}

      <div
        className={cn(
          'max-w-[78%] rounded-2xl border p-3',
          isMine
            ? 'rounded-br-md border-electric-green/40 bg-electric-green/[0.10] shadow-[0_0_8px_rgba(0,255,135,0.2)]'
            : 'rounded-bl-md border-white/[0.07] bg-white/[0.04]',
        )}>
        {!isMine ? (
          <p className="truncate text-[11px] font-black uppercase tracking-[0.12em] text-white/55">
            {displayName}
          </p>
        ) : null}

        {isSticker && stickerMetadata ? (
          <div className="flex flex-col items-center gap-2 py-1">
            <ChatStickerPreview itemId={stickerMetadata.stickerId} />
            <span className="text-xs font-black uppercase text-white/70">
              {stickerMetadata.stickerName}
            </span>
          </div>
        ) : (
          <p
            className={cn(
              'whitespace-pre-wrap break-words text-sm font-semibold leading-5',
              isMine ? 'text-white' : 'text-white/85',
            )}>
            {message.body}
          </p>
        )}

        {isBetShare && metadata ? <SharedBetCard metadata={metadata} /> : null}

        <div
          className={cn(
            'mt-1.5 flex items-center gap-2',
            isMine ? 'justify-end' : 'justify-between',
          )}>
          {!isMine ? (
            <button
              aria-label={`Report or block ${displayName}`}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white/50 transition hover:border-coral-red/40 hover:text-coral-red"
              onClick={() => onOpenActions(message, displayName)}
              type="button">
              <Flag aria-hidden className="h-3 w-3" />
            </button>
          ) : null}
          <span
            className={cn(
              'text-[10px] font-semibold',
              isMine ? 'text-electric-green/60' : 'text-white/40',
            )}>
            {getShortTime(message.created_at)}
          </span>
        </div>
      </div>

      {isMine ? <CosmeticAvatar cosmetics={cosmetics} name={displayName} size="sm" /> : null}
    </li>
  );
}

/**
 * The league chat, ported from the mobile hub's Chat tab.
 *
 * Realtime, stickers, and the full moderation path (report a message, block a
 * player, accept the chat terms) all behave as they do on mobile. What changes
 * is the surface: mobile hides chat behind a tab and native Alerts, while on
 * desktop it sits permanently beside the standings and its prompts are modals.
 */
export function LeagueChatPanel({
  className,
  cosmeticsByUserId,
  detail,
  userId,
}: {
  className?: string;
  cosmeticsByUserId: Record<string, EquippedCosmeticsByCategory>;
  detail: LeagueDetail;
  userId: string;
}) {
  const [limit, setLimit] = useState(30);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [hasNewMessages, setHasNewMessages] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [actionTarget, setActionTarget] = useState<ChatActionTarget | null>(null);
  const [blockTarget, setBlockTarget] = useState<ChatActionTarget | null>(null);
  const [reportTarget, setReportTarget] = useState<ChatActionTarget | null>(null);
  const [reportReason, setReportReason] = useState<MessageReportReason>('Spam');
  const [reportDetails, setReportDetails] = useState('');
  const [termsVisible, setTermsVisible] = useState(false);
  const [locallyBlockedUserIds, setLocallyBlockedUserIds] = useState<Set<string>>(() => new Set());

  const scrollRef = useRef<HTMLDivElement>(null);
  const previousMessageCount = useRef(0);

  const chatQuery = useLeagueChat(detail.league.id, limit);
  const reportMessage = useReportMessageMutation(userId);
  const blockUser = useBlockUserMutation(userId);
  const chatStatus = useChatModerationStatus(userId);
  const acceptChatTerms = useAcceptChatTermsMutation(userId);
  const sendMessage = useSendLeagueChatMessage(detail.league.id, userId);
  const sendSticker = useSendLeagueChatSticker(detail.league.id, userId);
  const userCosmetics = useUserCosmetics(userId);

  const messages = useMemo(() => chatQuery.data ?? [], [chatQuery.data]);
  const memberByUserId = useMemo(
    () =>
      detail.members.reduce<Record<string, LeagueMemberRow>>((accumulator, member) => {
        accumulator[member.user_id] = member;
        return accumulator;
      }, {}),
    [detail.members],
  );
  const visibleMessages = useMemo(
    () => messages.filter((message) => !message.user_id || !locallyBlockedUserIds.has(message.user_id)),
    [locallyBlockedUserIds, messages],
  );

  const draftFilterError = draft.trim().length > 0 ? getChatContentFilterMessage(draft) : null;
  const isChatBanned = chatStatus.data?.chat_banned === true;
  const hasAcceptedChatTerms = Boolean(chatStatus.data?.chat_terms_accepted_at);
  // Mobile gates on `isLoading || isFetching`. On the web that second term
  // also covers TanStack's refetch-on-window-focus, so every tab-back would
  // grey the composer out for a beat. `isLoading` alone is the same guard —
  // hold sends until the player's chat status is known for the first time.
  const isChatStatusLoading = chatStatus.isLoading;
  const canSend =
    draft.trim().length > 0 &&
    !sendMessage.isPending &&
    !isChatStatusLoading &&
    !draftFilterError &&
    !isChatBanned;
  const stickerRows = (userCosmetics.data?.rows ?? []).filter(
    (row) => row.category === 'chat_sticker_pack',
  );

  const scrollToBottom = () => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  };

  useEffect(() => {
    const previousCount = previousMessageCount.current;
    previousMessageCount.current = visibleMessages.length;

    if (visibleMessages.length === 0 || visibleMessages.length <= previousCount) {
      return;
    }

    if (previousCount === 0 || isNearBottom) {
      // One frame later, so the new bubbles are laid out before we measure.
      requestAnimationFrame(scrollToBottom);
    } else {
      setHasNewMessages(true);
    }
  }, [isNearBottom, visibleMessages.length]);

  useEffect(() => {
    if (!status) return;

    const timer = setTimeout(() => setStatus(null), 4000);
    return () => clearTimeout(timer);
  }, [status]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { clientHeight, scrollHeight, scrollTop } = event.currentTarget;
    const nearBottom = scrollHeight - (scrollTop + clientHeight) < 80;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setHasNewMessages(false);
    }
  };

  const sendCurrentMessage = async () => {
    const nextMessage = draft.trim();
    if (!nextMessage) {
      return;
    }

    setDraft('');
    setSendError(null);
    try {
      await sendMessage.mutateAsync(nextMessage);
    } catch (error) {
      const sendFailure = getChatInsertErrorAction(error);
      setDraft(nextMessage);
      setSendError(sendFailure.message);
      if (sendFailure.action === 'terms') {
        setTermsVisible(true);
      }
    }
    requestAnimationFrame(scrollToBottom);
  };

  const submitMessage = async () => {
    if (!draft.trim()) {
      return;
    }

    if (isChatStatusLoading) {
      setSendError('Checking chat access. Try again in a moment.');
      return;
    }

    if (draftFilterError) {
      setSendError(draftFilterError);
      return;
    }

    if (isChatBanned) {
      setSendError('This account is not allowed to post in chat.');
      return;
    }

    if (!hasAcceptedChatTerms) {
      setTermsVisible(true);
      return;
    }

    await sendCurrentMessage();
  };

  const submitSticker = async (itemId: string) => {
    const item = getCosmeticItem(itemId);
    if (!item) return;

    if (isChatBanned) {
      setSendError('This account is not allowed to post in chat.');
      return;
    }

    if (isChatStatusLoading) {
      setSendError('Checking chat access. Try again in a moment.');
      return;
    }

    if (!hasAcceptedChatTerms) {
      setTermsVisible(true);
      return;
    }

    try {
      await sendSticker.mutateAsync({ stickerId: item.id, stickerName: item.name });
      setSendError(null);
    } catch (error) {
      const sendFailure = getChatInsertErrorAction(error);
      setSendError(sendFailure.message);
      if (sendFailure.action === 'terms') {
        setTermsVisible(true);
      }
    }
    requestAnimationFrame(scrollToBottom);
  };

  const acceptTermsAndContinue = async () => {
    try {
      await acceptChatTerms.mutateAsync();
      const refreshedStatus = await chatStatus.refetch();
      if (!refreshedStatus.data?.chat_terms_accepted_at) {
        throw new Error('Chat terms acceptance did not refresh. Try again.');
      }
      setTermsVisible(false);
      setSendError(null);
      if (draft.trim() && !draftFilterError && !isChatBanned) {
        await sendCurrentMessage();
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not save agreement.');
      setTermsVisible(false);
    }
  };

  const openMessageActions = (message: LeagueChatMessage, displayName: string) => {
    if (!message.user_id || message.user_id === userId) {
      return;
    }

    setActionTarget({ displayName, message });
  };

  const submitReport = async () => {
    const target = reportTarget;
    if (!target?.message.user_id) {
      return;
    }

    try {
      await reportMessage.mutateAsync({
        details: reportDetails,
        leagueId: detail.league.id,
        reason: reportReason,
        reportedMessageId: target.message.id,
        reportedUserId: target.message.user_id,
      });
      setReportDetails('');
      setReportReason('Spam');
      setReportTarget(null);
      setStatus('Report sent. This message was flagged for moderation review.');
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not report message.');
      setReportTarget(null);
    }
  };

  const confirmBlock = async () => {
    const target = blockTarget;
    const blockedUserId = target?.message.user_id;
    if (!target || !blockedUserId) {
      return;
    }

    try {
      await blockUser.mutateAsync({ blockedUserId, leagueId: detail.league.id });
      setLocallyBlockedUserIds((current) => new Set(current).add(blockedUserId));
      setBlockTarget(null);
      setStatus(`${target.displayName}'s messages are hidden for you.`);
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Could not block user.');
      setBlockTarget(null);
    }
  };

  return (
    <>
      <Card className={cn('flex flex-col overflow-hidden', className)} padded={false}>
        <header className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-4 py-3">
          <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-electric-green">
            <MessagesSquare aria-hidden className="h-4 w-4" />
            League Chat
          </span>
          <Badge label={`${visibleMessages.length} shown`} tone="green" />
        </header>

        <div className="relative min-h-0 flex-1">
          <div
            className="h-full overflow-y-auto p-4"
            onScroll={handleScroll}
            ref={scrollRef}>
            {messages.length >= limit ? (
              <button
                className="mb-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black uppercase text-white/60 transition hover:bg-white/[0.08]"
                onClick={() => setLimit((current) => current + 30)}
                type="button">
                Load Older Messages
              </button>
            ) : null}

            {chatQuery.isLoading ? (
              <div className="flex flex-col gap-3">
                {[0, 1, 2].map((item) => (
                  <Skeleton height={70} key={item} radius={16} />
                ))}
              </div>
            ) : null}

            {!chatQuery.isLoading && visibleMessages.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-14">
                <span className="flex h-14 w-14 items-center justify-center rounded-full border border-electric-green/30 bg-electric-green/10">
                  <MessagesSquare aria-hidden className="h-6 w-6 text-electric-green" />
                </span>
                <p className="text-center text-base font-semibold text-white/55">
                  No league chatter yet. First message sets the tone.
                </p>
              </div>
            ) : null}

            <ul className="flex flex-col gap-3">
              {visibleMessages.map((message) => (
                <ChatBubble
                  cosmetics={message.user_id ? cosmeticsByUserId[message.user_id] : undefined}
                  isMine={message.user_id === userId}
                  key={message.id}
                  member={message.user_id ? memberByUserId[message.user_id] : undefined}
                  message={message}
                  onOpenActions={openMessageActions}
                />
              ))}
            </ul>
          </div>

          {hasNewMessages ? (
            <div className="pointer-events-none absolute bottom-3 left-0 right-0 flex justify-center">
              <button
                className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-electric-green/45 bg-arena-bg px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-electric-green"
                onClick={() => {
                  setHasNewMessages(false);
                  scrollToBottom();
                }}
                type="button">
                <ArrowDown aria-hidden className="h-3 w-3" />
                New messages
              </button>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-white/[0.08] p-3">
          {stickerRows.length > 0 ? (
            <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
              {stickerRows.map((row) => {
                const item = getCosmeticItem(row.item_id);
                if (!item) return null;

                return (
                  <button
                    className="flex shrink-0 flex-col items-center gap-1 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 transition hover:bg-white/[0.08] disabled:opacity-50"
                    disabled={sendSticker.isPending}
                    key={row.id}
                    onClick={() => void submitSticker(row.item_id)}
                    type="button">
                    <ChatStickerPreview itemId={row.item_id} size="sm" />
                    <span className="max-w-[72px] truncate text-[9px] font-black uppercase text-white/55">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}

          {status ? (
            <Notice className="mb-2" tone="success">
              {status}
            </Notice>
          ) : null}

          {draftFilterError || sendError || isChatBanned ? (
            <p className="mb-2 text-xs font-bold leading-5 text-coral-red">
              {isChatBanned
                ? 'This account is not allowed to post in chat.'
                : (draftFilterError ?? sendError)}
            </p>
          ) : null}

          <div className="flex items-end gap-2">
            <FieldTextarea
              containerClassName="flex-1"
              hideLabel
              label="Message"
              onChange={(event) => {
                setDraft(event.target.value);
                setSendError(null);
              }}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter breaks the line — the desktop
                // convention, and the reason this stays a textarea.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  void submitMessage();
                }
              }}
              placeholder="Talk your talk..."
              rows={2}
              value={draft}
            />
            <button
              aria-label="Send message"
              className={cn(
                'flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border transition',
                canSend
                  ? 'border-electric-green/45 bg-electric-green/20 text-electric-green hover:bg-electric-green/30'
                  : 'cursor-not-allowed border-white/10 bg-white/[0.04] text-white/35',
              )}
              disabled={!canSend}
              onClick={() => void submitMessage()}
              type="button">
              <Send aria-hidden className="h-[18px] w-[18px]" />
            </button>
          </div>
        </div>
      </Card>

      {/* Mobile puts these three behind native Alerts and action sheets. */}
      <Modal
        footer={
          <Button fullWidth={false} onClick={() => setActionTarget(null)} title="Cancel" variant="secondary" />
        }
        onClose={() => setActionTarget(null)}
        open={Boolean(actionTarget)}
        subtitle={actionTarget?.displayName ?? 'League member'}
        title="Message Options">
        <div className="flex flex-col gap-3">
          <Button
            icon={Flag}
            onClick={() => {
              if (!actionTarget) return;
              setReportReason('Spam');
              setReportDetails('');
              setReportTarget(actionTarget);
              setActionTarget(null);
            }}
            title="Report Message"
            variant="secondary"
          />
          <Button
            icon={Ban}
            onClick={() => {
              if (!actionTarget) return;
              setBlockTarget(actionTarget);
              setActionTarget(null);
            }}
            title="Block User"
            variant="destructive"
          />
        </div>
      </Modal>

      <Modal
        footer={
          <>
            <Button
              disabled={blockUser.isPending}
              fullWidth={false}
              onClick={() => setBlockTarget(null)}
              title="Cancel"
              variant="secondary"
            />
            <Button
              fullWidth={false}
              loading={blockUser.isPending}
              onClick={() => void confirmBlock()}
              title="Block"
              variant="destructive"
            />
          </>
        }
        onClose={() => setBlockTarget(null)}
        open={Boolean(blockTarget)}
        title={`Block ${blockTarget?.displayName ?? 'this player'}?`}>
        <p className="text-sm font-semibold text-white/65">
          You won&apos;t see their chat messages anymore. Other league members can still see them.
        </p>
      </Modal>

      <Modal
        footer={
          <>
            <Button
              disabled={reportMessage.isPending}
              fullWidth={false}
              onClick={() => setReportTarget(null)}
              title="Cancel"
              variant="secondary"
            />
            <Button
              fullWidth={false}
              loading={reportMessage.isPending}
              onClick={() => void submitReport()}
              title="Submit"
            />
          </>
        }
        onClose={() => setReportTarget(null)}
        open={Boolean(reportTarget)}
        subtitle={reportTarget?.displayName ?? 'League member'}
        title="Report Message">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {MESSAGE_REPORT_REASONS.map((option) => {
              const selected = option === reportReason;

              return (
                <button
                  aria-pressed={selected}
                  className={cn(
                    'rounded-full border px-3 py-2 text-[11px] font-black uppercase tracking-[0.08em] transition',
                    selected
                      ? 'border-electric-green bg-electric-green/15 text-electric-green'
                      : 'border-white/10 bg-white/[0.04] text-white/60 hover:text-white',
                  )}
                  key={option}
                  onClick={() => setReportReason(option)}
                  type="button">
                  {option}
                </button>
              );
            })}
          </div>

          <FieldTextarea
            label="Details (optional)"
            onChange={(event) => setReportDetails(event.target.value)}
            placeholder="Optional details for the moderator"
            rows={4}
            value={reportDetails}
          />
        </div>
      </Modal>

      <Modal
        footer={
          <Button
            fullWidth={false}
            loading={acceptChatTerms.isPending}
            onClick={() => void acceptTermsAndContinue()}
            title="Agree & Continue"
          />
        }
        onClose={() => setTermsVisible(false)}
        open={termsVisible}
        subtitle="Zero Tolerance"
        title="Chat Terms">
        <div className="flex flex-col gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-coral-red/45 bg-coral-red/15">
            <ShieldCheck aria-hidden className="h-6 w-6 text-coral-red" />
          </span>
          <p className="text-sm font-semibold leading-5 text-white/60">
            Objectionable content, harassment, hate speech, explicit content, threats, and abusive
            behavior are not allowed. Messages can be reported, hidden, and reviewed. Accounts that
            abuse chat can be blocked or banned.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-sm font-black uppercase tracking-[0.12em]">
            <Link className="text-electric-green hover:brightness-110" target="_blank" to={ROUTES.terms}>
              Terms
            </Link>
            <a className="text-electric-green hover:brightness-110" href={`mailto:${SUPPORT_EMAIL}`}>
              Support
            </a>
            <span className="text-xs font-semibold normal-case tracking-normal text-white/45">
              {SUPPORT_EMAIL}
            </span>
          </div>
        </div>
      </Modal>
    </>
  );
}
