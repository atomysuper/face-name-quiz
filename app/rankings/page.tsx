import Link from 'next/link';

import { listRankings } from '@/lib/supabase-admin';
import { requireSitePage } from '@/lib/site-auth';

export const dynamic = 'force-dynamic';

export default async function RankingsPage() {
  await requireSitePage();

  const rankings = await listRankings(30);

  return (
    <section className="stack-lg">
      <div className="stack-xs">
        <h1>🏆 순위표</h1>
        <p className="lead">10개 이상 맞힌 사람들의 점수 순위입니다.</p>
      </div>

      <Link className="button ghost" href="/quiz">
        퀴즈 시작하기
      </Link>

      {rankings.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>📭</p>
          <p style={{ fontWeight: 600 }}>아직 등록된 순위가 없습니다</p>
          <p className="muted-text" style={{ fontSize: '0.9rem', marginTop: 4 }}>
            퀴즈에서 10개 이상 맞히면 순위를 등록할 수 있어요!
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="rankings-table">
            <thead>
              <tr>
                <th>순위</th>
                <th>닉네임</th>
                <th>정답 수</th>
                <th>총 점수</th>
                <th>날짜</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((entry, index) => (
                <tr key={entry.id} className={index < 3 ? 'ranking-top' : undefined}>
                  <td className="ranking-rank">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}위`}
                  </td>
                  <td className="ranking-nickname">{entry.nickname}</td>
                  <td>{entry.correctCount}개</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{entry.score}점</td>
                  <td className="muted-text" style={{ fontSize: '0.85rem' }}>
                    {new Date(entry.createdAt).toLocaleDateString('ko-KR', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
