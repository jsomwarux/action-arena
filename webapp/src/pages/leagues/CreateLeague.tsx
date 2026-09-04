import { useState, type FormEvent } from 'react';

import { Check, Globe, Lock, TrendingUp, Users, type LucideIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Badge, Button, Card, Notice, TextInput } from '@/components/ui';
import {
  LEAGUE_SPORT_OPTIONS,
  LEAGUE_TYPE_OPTIONS,
  LEAGUE_VISIBILITY_OPTIONS,
  MAX_MEMBER_OPTIONS,
} from '@/constants/league-options';
import { useAuth } from '@/hooks/use-auth';
import { getLeagueNameValidationError, useCreateLeagueMutation } from '@/hooks/use-leagues';
import { cn } from '@/lib/cn';
import { buildRoute } from '@/lib/routes';
import type { LeagueSport, LeagueType, LeagueVisibility } from '@/types/database';

const LEAGUE_TYPE_ICONS: Record<LeagueType, LucideIcon> = {
  cumulative: TrendingUp,
  h2h: Users,
};

const VISIBILITY_ICONS: Record<LeagueVisibility, LucideIcon> = {
  private: Lock,
  public: Globe,
};

const CREATE_LEAGUE_ERROR_MESSAGE =
  'We could not create that league. Please check the details and try again.';

function SectionHeader({ subtitle, title }: { subtitle?: string; title: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[11px] font-black uppercase tracking-[0.25em] text-electric-green">
        {title}
      </p>
      {subtitle ? <p className="text-sm font-semibold text-white/55">{subtitle}</p> : null}
    </div>
  );
}

function ToggleOption({
  description,
  icon: Icon,
  isSelected,
  label,
  onSelect,
}: {
  description?: string;
  icon: LucideIcon;
  isSelected: boolean;
  label: string;
  onSelect: () => void;
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={cn(
        'flex w-full flex-col gap-3 rounded-2xl border p-4 text-left transition duration-150 ease-arena',
        isSelected
          ? 'border-electric-green bg-electric-green/10 shadow-[0_0_12px_rgba(0,255,135,0.4)]'
          : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.07]',
      )}
      onClick={onSelect}
      type="button">
      <span className="flex items-center justify-between">
        <span
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl border',
            isSelected
              ? 'border-electric-green/40 bg-electric-green/15'
              : 'border-white/10 bg-white/[0.04]',
          )}>
          <Icon
            aria-hidden
            className={cn('h-[18px] w-[18px]', isSelected ? 'text-electric-green' : 'text-white/65')}
          />
        </span>
        {isSelected ? (
          <Check aria-hidden className="h-5 w-5 text-electric-green" />
        ) : (
          <span aria-hidden className="h-5 w-5 rounded-full border border-white/15" />
        )}
      </span>
      <span className="flex flex-col gap-1">
        <span
          className={cn(
            'text-sm font-black uppercase tracking-[0.05em]',
            isSelected ? 'text-white' : 'text-white/85',
          )}>
          {label}
        </span>
        {description ? (
          <span className="text-xs font-semibold leading-4 text-white/55">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

/** Port of app/(app)/leagues/create.tsx. Same rules, same copy, two columns. */
export function CreateLeaguePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const createLeague = useCreateLeagueMutation(user?.id);
  const [name, setName] = useState('');
  const [type, setType] = useState<LeagueType>('h2h');
  const [visibility, setVisibility] = useState<LeagueVisibility>('private');
  const [maxMembers, setMaxMembers] = useState(10);
  const [sport, setSport] = useState<LeagueSport>('nfl');
  const [nameError, setNameError] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | undefined>();

  const trimmedName = name.trim();
  const currentNameError = getLeagueNameValidationError(name);
  const isNameValid = !currentNameError;

  const handleNameChange = (nextName: string) => {
    setName(nextName);

    if (nameError) {
      setNameError(getLeagueNameValidationError(nextName));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setNameError(undefined);
    setSubmitError(undefined);

    if (currentNameError) {
      setNameError(currentNameError);
      return;
    }

    try {
      const leagueId = await createLeague.mutateAsync({
        maxMembers,
        name: trimmedName,
        sport,
        type,
        visibility,
      });
      navigate(buildRoute.league(leagueId), { replace: true });
    } catch {
      setSubmitError(CREATE_LEAGUE_ERROR_MESSAGE);
    }
  };

  return (
    <section className="flex flex-col gap-6">
      <header>
        <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-electric-green">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-electric-green" />
          New League
        </span>
        <h1 className="arena-heading mt-1 text-5xl leading-none">Create League</h1>
        <p className="mt-1 text-sm font-medium text-white/55">
          Set the format now. You can tune deeper rules later as commissioner.
        </p>
      </header>

      <form className="flex flex-col gap-6" noValidate onSubmit={handleSubmit}>
        <Card className="flex flex-col gap-8">
          <TextInput
            containerClassName="max-w-xl"
            error={nameError}
            label="League name"
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Sunday Syndicate"
            value={name}
          />

          <div className="grid gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-3">
              <SectionHeader
                subtitle="Pick how members compete each week."
                title="League Format"
              />
              <div className="flex flex-col gap-3">
                {LEAGUE_TYPE_OPTIONS.map((option) => (
                  <ToggleOption
                    description={option.description}
                    icon={LEAGUE_TYPE_ICONS[option.value]}
                    isSelected={type === option.value}
                    key={option.value}
                    label={option.label}
                    onSelect={() => setType(option.value)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader
                subtitle="Public rooms appear in browse. Private requires the invite code."
                title="Visibility"
              />
              <div className="flex flex-col gap-3">
                {LEAGUE_VISIBILITY_OPTIONS.map((option) => (
                  <ToggleOption
                    description={option.description}
                    icon={VISIBILITY_ICONS[option.value]}
                    isSelected={visibility === option.value}
                    key={option.value}
                    label={option.label}
                    onSelect={() => setVisibility(option.value)}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader subtitle="Cap your roster anywhere from 4 to 12." title="Max Members" />
              <div className="flex flex-wrap gap-2">
                {MAX_MEMBER_OPTIONS.map((option) => {
                  const selected = maxMembers === option;

                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        'flex h-14 w-16 items-center justify-center rounded-2xl border text-lg font-black transition',
                        selected
                          ? 'border-electric-green bg-electric-green/15 text-electric-green shadow-[0_0_10px_rgba(0,255,135,0.4)]'
                          : 'border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]',
                      )}
                      key={option}
                      onClick={() => setMaxMembers(option)}
                      type="button">
                      {option}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <SectionHeader
                subtitle="Launching with NFL. NBA & MLB drop next season."
                title="Sport"
              />
              <div className="flex flex-wrap gap-2">
                {LEAGUE_SPORT_OPTIONS.map((option) => {
                  const selected = sport === option.value;

                  return (
                    <button
                      aria-pressed={selected}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-black tracking-[0.08em] transition',
                        selected
                          ? 'border-electric-green bg-electric-green/15 text-electric-green'
                          : 'border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.07]',
                        option.disabled && 'pointer-events-none opacity-35',
                      )}
                      disabled={option.disabled}
                      key={option.value}
                      onClick={() => setSport(option.value)}
                      type="button">
                      {selected ? <Check aria-hidden className="h-3.5 w-3.5" /> : null}
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <Badge label="NFL only at launch" tone="gold" />
            </div>
          </div>

          {submitError ? <Notice tone="error">{submitError}</Notice> : null}

          <Button
            className="max-w-xs"
            disabled={!isNameValid}
            loading={createLeague.isPending}
            title="Create League"
            type="submit"
          />
        </Card>
      </form>
    </section>
  );
}
