import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { limitNumber } from "../../libs/utils";
import { isMobile } from "../../libs/mobile";
import { putFab } from "../../libs/storage";
import { debounce } from "../../libs/utils";
import Paper from "@mui/material/Paper";

const FAB_EDGES = ["left", "right", "top", "bottom"];

// 计算当前位置最近的视口边缘
export const getNearestEdge = ({
  x: left,
  y: top,
  width,
  height,
  windowWidth,
  windowHeight,
}) => {
  const right = windowWidth - left - width;
  const bottom = windowHeight - top - height;
  const min = Math.min(left, top, right, bottom);
  switch (min) {
    case right:
      return "right";
    case left:
      return "left";
    case bottom:
      return "bottom";
    default:
      return "top";
  }
};

// Position the control on one edge while keeping the cross-axis fully visible.
export const getEdgePosition = ({
  x: left,
  y: top,
  width,
  height,
  windowWidth,
  windowHeight,
  revealed,
  edge,
}) => {
  const maxLeft = Math.max(0, windowWidth - width);
  const maxTop = Math.max(0, windowHeight - height);

  switch (edge) {
    case "right":
      left = revealed ? windowWidth - width : windowWidth - width / 2;
      top = limitNumber(top, 0, maxTop);
      break;
    case "left":
      left = revealed ? 0 : -width / 2;
      top = limitNumber(top, 0, maxTop);
      break;
    case "bottom":
      left = limitNumber(left, 0, maxLeft);
      top = revealed ? windowHeight - height : windowHeight - height / 2;
      break;
    default:
      left = limitNumber(left, 0, maxLeft);
      top = revealed ? 0 : -height / 2;
  }
  return { x: left, y: top };
};

// 拖拽容器的包装器组件，支持通过 usePaper 配置决定是否使用 Material UI 的 Paper 阴影卡片背景
function DraggableWrapper({ children, usePaper, ...props }) {
  if (usePaper) {
    return (
      <Paper {...props} elevation={4}>
        {children}
      </Paper>
    );
  }
  return <div {...props}>{children}</div>;
}

/**
 * 拖拽交互容器组件，支持非移动端 Pointer 事件和移动端 Touch 事件
 * 同时支持贴边自动吸附及鼠标悬浮半展开效果
 */
export default function Draggable({
  windowSize: { w: windowWidth, h: windowHeight },
  width,
  height,
  left,
  top,
  edge: savedEdge,
  show = true,
  snapEdge,
  onStart,
  onMove,
  handler, // 点击并开始拖拽的触发区域
  children, // 容器内部的主体渲染元素
  usePaper,
  // The transformed wrapper is the containing block for fixed descendants.
  // Let it fit the action menu while edge snapping still uses the explicit width.
  fitContent,
  expanded, // Keep the anchor revealed while a child overlay is expanded.
}) {
  const [hover, setHover] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [positionTransitionEnabled, setPositionTransitionEnabled] =
    useState(false);
  const [origin, setOrigin] = useState(null); // 拖动起始的参考原点坐标和 client 坐标
  const [edge, setEdge] = useState(
    FAB_EDGES.includes(savedEdge) ? savedEdge : null
  );
  const containerRef = useRef(null);
  const draggedRef = useRef(false);
  const revealed = hover || focusWithin || expanded || Boolean(origin);

  // 用百分比的形式保存位置，以便在视口大小 resize 时等比例缩放位置
  // REVIEW: 这里的 left / windowWidth 和 top / windowHeight 在首帧 windowWidth/Height 为 0 的异常场景下，
  // 会产生值为 NaN 或 Infinity 的致命错误。推荐使用 (windowWidth || 1) 对除数进行安全拦截。
  const latestPosition = useRef({
    x: left / windowWidth,
    y: top / windowHeight,
  });
  const latestEdge = useRef(edge);
  const [position, setPosition] = useState({
    x: left / windowWidth,
    y: top / windowHeight,
  });
  // 缓存防抖的 putFab，用于将最新的拖拽坐标写入本地 storage 持久化
  const setFabPosition = useMemo(() => debounce(putFab, 500), []);

  // 执行 transform 移动的 DOM 操作
  const applyTransform = useCallback((x, y) => {
    if (containerRef.current) {
      containerRef.current.style.transform = `translate(${x}px, ${y}px)`;
    }
  }, []);

  // 同步最新位置的 Ref
  useEffect(() => {
    latestPosition.current = position;
  }, [position]);

  useEffect(() => {
    latestEdge.current = edge;
  }, [edge]);

  // 监听 resize 事件，自适应保持拖拽组件在屏幕中的相对比例坐标
  useEffect(() => {
    const onResize = () => {
      if (!containerRef.current) return;
      const { x: px, y: py } = latestPosition.current;
      const newWindowWidth = document.documentElement.clientWidth;
      const newWindowHeight = document.documentElement.clientHeight;
      const currentPosition = {
        x: px * newWindowWidth,
        y: py * newWindowHeight,
      };

      if (snapEdge && latestEdge.current) {
        const edgePosition = getEdgePosition({
          ...currentPosition,
          width,
          height,
          windowWidth: newWindowWidth,
          windowHeight: newWindowHeight,
          revealed,
          edge: latestEdge.current,
        });
        applyTransform(edgePosition.x, edgePosition.y);
        return;
      }

      applyTransform(currentPosition.x, currentPosition.y);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyTransform, height, revealed, snapEdge, width]);

  // 贴边自动吸附效果逻辑
  useEffect(() => {
    if (!snapEdge || !!origin) {
      return;
    }

    const currentPosition = {
      x: position.x * windowWidth,
      y: position.y * windowHeight,
    };

    const activeEdge =
      edge ||
      getNearestEdge({
        ...currentPosition,
        width,
        height,
        windowWidth,
        windowHeight,
      });
    if (!edge) {
      setEdge(activeEdge);
      latestEdge.current = activeEdge;
    }

    const edgePosition = getEdgePosition({
      ...currentPosition,
      width,
      height,
      windowWidth,
      windowHeight,
      revealed,
      edge: activeEdge,
    });

    applyTransform(edgePosition.x, edgePosition.y);

    const percentageEdge = {
      x: edgePosition.x / windowWidth,
      y: edgePosition.y / windowHeight,
    };
    setPosition(percentageEdge);
    setFabPosition({ ...edgePosition, edge: activeEdge });
  }, [
    edge,
    origin,
    revealed,
    width,
    height,
    windowWidth,
    windowHeight,
    snapEdge,
    setFabPosition,
    position.x,
    position.y,
    applyTransform,
  ]);

  useEffect(() => {
    setPositionTransitionEnabled(true);
  }, []);

  // 鼠标/手指按下，标记拖拽开始并记录起始坐标
  const handlePointerDown = (e) => {
    if (
      usePaper &&
      e.target.closest?.("button, a, input, select, textarea, [role='button']")
    ) {
      return;
    }
    // 注意：这里不能像 Selection/DraggableResizable 那样加「按在 button 上就不起拖」
    // 的护栏——悬浮球的拖拽触发区本身就是一个 <button>，加了它整个球就拖不动了。
    // 动作菜单挂在 children 上，那一侧没有绑指针监听，本来就不会误触发拖拽。
    !isMobile && e.target.setPointerCapture(e.pointerId); // 捕获指针事件，使得移出当前元素时仍能响应 move
    onStart && onStart();
    draggedRef.current = false;
    const rect = containerRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : position.x * windowWidth;
    const currentY = rect ? rect.top : position.y * windowHeight;
    const { clientX, clientY } = isMobile ? e.targetTouches[0] : e;
    setOrigin({ x: currentX, y: currentY, clientX, clientY });
  };

  // 鼠标/手指拖动，计算当前位移偏差并移动 DOM
  const handlePointerMove = (e) => {
    if (!origin) return;
    onMove && onMove();
    draggedRef.current = true;
    const { clientX, clientY } = isMobile ? e.targetTouches[0] : e;
    const dx = clientX - origin.clientX;
    const dy = clientY - origin.clientY;
    let x = origin.x + dx;
    let y = origin.y + dy;

    // 对拖动范围做视口越界拦截保护
    x = limitNumber(x, -width / 2, windowWidth - width / 2);
    y = limitNumber(y, 0, windowHeight - height / 2);

    applyTransform(x, y);
    const relativePosition = {
      x: x / windowWidth,
      y: y / windowHeight,
    };
    setPosition(relativePosition);
    latestPosition.current = relativePosition;
  };

  // 鼠标松开/手指抬起，清除拖拽 origin，并阻止事件冒泡防止底层元素误触
  const handlePointerUp = (e) => {
    e.stopPropagation();
    if (snapEdge && draggedRef.current) {
      const currentPosition = {
        x: latestPosition.current.x * windowWidth,
        y: latestPosition.current.y * windowHeight,
      };
      const nextEdge = getNearestEdge({
        ...currentPosition,
        width,
        height,
        windowWidth,
        windowHeight,
      });
      setEdge(nextEdge);
      latestEdge.current = nextEdge;
    }
    setOrigin(null);
  };

  const handleClick = (e) => {
    e.stopPropagation();
  };

  const handleMouseEnter = (e) => {
    e.stopPropagation();
    setHover(true);
  };

  const handleMouseLeave = (e) => {
    e.stopPropagation();
    setHover(false);
  };

  const handleFocusCapture = () => {
    setFocusWithin(true);
  };

  const handleBlurCapture = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setFocusWithin(false);
    }
  };

  // M3 FABs remain fully opaque; non-snapped panels still soften while dragging.
  const opacity = useMemo(() => {
    if (snapEdge) {
      return 1;
    }
    return origin ? 0.8 : 1;
  }, [origin, snapEdge]);

  const transition =
    positionTransitionEnabled && !origin
      ? "opacity 160ms ease, transform 180ms cubic-bezier(.2, 0, 0, 1)"
      : "opacity 160ms ease";

  // 根据移动端/PC端不同绑定不同的触摸/指针监听属性
  // cancel 分支不是可选的：pointercancel / touchcancel 之后浏览器不会再补发
  // pointerup / touchend，而清空 origin 的唯一出口就在 handlePointerUp 里。
  // 少了它，一次被系统手势打断的拖拽会让 origin 永久残留，之后指针只要掠过
  // 触发区就会继续拖动——没有按下任何键。
  const touchProps = isMobile
    ? {
        onTouchStart: handlePointerDown,
        onTouchMove: handlePointerMove,
        onTouchEnd: handlePointerUp,
        onTouchCancel: handlePointerUp,
      }
    : {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
      };

  return (
    <div
      ref={containerRef}
      style={{
        width: fitContent ? undefined : width,
        opacity,
        transition,
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 2147483647,
        display: show ? "block" : "none",
        willChange: "transform, opacity",
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
      onClick={handleClick}
    >
      <DraggableWrapper usePaper={usePaper}>
        <div
          style={{
            touchAction: "none", // 阻止浏览器默认的手势滑页行为，以便拖拽正常工作
          }}
          {...touchProps}
        >
          {handler}
        </div>
        <div>{children}</div>
      </DraggableWrapper>
    </div>
  );
}
