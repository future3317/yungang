import { X } from 'lucide-react';
import type { SiteReference } from '../../types/game';
import { assetUrl } from '../../shared/assetUrl';
import { contentClassName, statusName } from './inspectorFormatters';

export function SiteInspectorSummary({
  site,
  siteType,
  siteDescription,
  onCollapse,
}: {
  site: SiteReference;
  siteType: string;
  siteDescription: string;
  onCollapse: () => void;
}) {
  return (
    <>
      <button type="button" className="inspector-collapse" onClick={onCollapse} aria-label="收起地点详情">
        <X size={16} />
      </button>
      <header className="inspector-summary" tabIndex={0} aria-label="地点摘要">
        <div className="inspector-site-mark">
          <img src={assetUrl(site.icon_asset || undefined, 'ornaments/heritage-medallion-1.webp')} alt="" />
        </div>
        <div className="inspector-site-copy">
          <h2>{site.name}</h2>
          <div className="inspector-meta">
            <span>{siteType}</span>
            <span className="content-class-badge">{contentClassName(site.content_class)}</span>
            <span className={site.status}>{statusName(site.status)}</span>
          </div>
        </div>
        {site.status === 'at_risk' && (
          <div className="site-alert-explanation">
            <b>高风险 · 再受 1 点损伤将关闭</b>
            <span>建议优先修护或降低本轮事件影响。</span>
          </div>
        )}
        {site.status === 'closed' && (
          <div className="site-alert-explanation is-closed">
            <b>节点已关闭</b>
            <span>这里暂时不能继续行动，需要先通过修护或事件应对恢复网络。</span>
          </div>
        )}
        <p>{site.summary || siteDescription || '在这里寻找能够连接不同地点与文化脉络的证据。'}</p>
      </header>
    </>
  );
}
