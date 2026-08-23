import { ArrowLeft, Compass, Keyboard, Library, Map, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import '../../styles/lobby.css';
import { Button } from '../../widgets/ui/Primitives';

export function HelpPage() {
  const navigate = useNavigate();
  return (
    <main className="room-screen">
      <header className="room-topbar">
        <button className="room-back" onClick={() => navigate('/')}>
          <ArrowLeft size={17} />
          返回首页
        </button>
        <span>旅程手册</span>
      </header>
      <section className="room-card help-card">
        <span className="eyebrow">石窟光谱 · 旅程手册</span>
        <h1>让线索彼此照见</h1>
        <p>你们会在有限回合中移动、寻访证据、交付和修护。地图展示关系，节点保存故事，证据卡保存尚未归位的证据关系。</p>
        <div className="help-grid">
          <article>
            <Map />
            <h2>沿路线前行</h2>
            <p>点击移动后，地图只显出当前可抵达的节点。查看其他节点不会消耗行动点。</p>
          </article>
          <article>
            <Library />
            <h2>寻访证据卡</h2>
            <p>公开市场每回合展示三件证据卡。金边证据卡回应当前委托，其他证据卡可能在后续节点派上用场。</p>
          </article>
          <article>
            <Users />
            <h2>共同完成委托</h2>
            <p>把不同来源的证据卡交付给地点任务。完成互证后，团队影响和遗产网络都会发生变化。</p>
          </article>
          <article>
            <Keyboard />
            <h2>快捷操作</h2>
            <p>
              <kbd>Escape</kbd> 收回当前选择；地图可用聚焦和缩放工具查看全局，行动确认前可以随时搁置。
            </p>
          </article>
        </div>
        <Button context="help" onClick={() => navigate('/')}>
          <Compass size={16} />
          回到旅程入口
        </Button>
      </section>
    </main>
  );
}
