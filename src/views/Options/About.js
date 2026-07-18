import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import ReactMarkdown from "react-markdown";
import { useI18n, useI18nMd } from "../../hooks/I18n";

const MARKDOWN_COMPONENTS = {
  a: ({ href, children }) => {
    const normalizedHref = href?.trim();
    const hasUnsafeScheme =
      normalizedHref &&
      /^[a-z][a-z0-9+.-]*:/i.test(normalizedHref) &&
      !/^(https?|mailto):/i.test(normalizedHref);

    if (!normalizedHref || hasUnsafeScheme) {
      return <span>{children}</span>;
    }

    return <a href={normalizedHref}>{children}</a>;
  },
};

/**
 * 关于面板组件 (在设置页展示关于/帮助的 MD 格式文档)
 */
export default function About() {
  const i18n = useI18n();
  // 异步拉取名为 "about_md" 的本地化 Markdown 文档数据
  const { data, loading, error } = useI18nMd("about_md");

  return (
    <Box>
      {loading ? (
        /* 加载状态中，居中显示圆形等待条 */
        <center>
          <CircularProgress />
        </center>
      ) : (
        /* 成功后，使用 ReactMarkdown 渲染排版。若拉取失败，展示后备的纯文本说明 */
        <ReactMarkdown components={MARKDOWN_COMPONENTS}>
          {error ? i18n("about_md_local") : data}
        </ReactMarkdown>
      )}
    </Box>
  );
}
