import * as React from "react";
import Svg, { Path } from "react-native-svg";
import PropTypes from 'prop-types';

const IconeIcon = (props) => {
  // Define a cor a ser usada: prioriza 'color', depois 'stroke', depois o padrão '#fff'
  const iconColor = props.color || props.stroke || "#fff";
  // Define o tamanho: prioriza 'width'/'height', depois 'size', depois os padrões originais
  // Note: Original dimensions are 34x32
  const iconWidth = props.width || props.size || 35;
  const iconHeight = props.height || props.size || 35;

return(
  <Svg
    width={iconWidth}   // Usa o tamanho dinâmico
    height={iconHeight} // Usa o tamanho dinâmico
    fill="none"
    viewBox="0 0 55 55" // Mantém o viewBox original para escalar corretamente
    {...props}
  >
    <Path
      stroke={iconColor}
      strokeLinecap="round"
      strokeWidth={2}
      d="M1 33.5h2m37.5 0h-2M3 33.5V1h35.5v32.5M3 33.5h35.5"
    ></Path>
    <Path
      stroke={iconColor}
      strokeLinecap="round"
      strokeWidth={2}
      d="M6.5 33.5V20H15v13.5"
    ></Path>
    <Path
      stroke={iconColor}
      strokeLinecap="round"
      d="M22.828 16.035a.534.534 0 1 1 1.069 0v3.592q0 .573-.222.994-.22.422-.612.65a1.8 1.8 0 0 1-.912.229q-.462 0-.84-.188a1.4 1.4 0 0 1-.594-.578 1.6 1.6 0 0 1-.164-.44c-.065-.294.19-.54.49-.54h.12c.23 0 .4.194.496.402q.08.165.217.254a.6.6 0 0 0 .33.087.56.56 0 0 0 .337-.098.6.6 0 0 0 .213-.295q.072-.194.072-.477zM26.47 21.42a.675.675 0 0 1-.654-.514L24.652 16.2a.565.565 0 1 1 1.101-.25l.75 3.642a.026.026 0 0 0 .051 0l.818-3.599a.633.633 0 0 1 1.235 0l.815 3.607a.028.028 0 0 0 .054 0l.75-3.65a.565.565 0 1 1 1.1.25l-1.163 4.706a.675.675 0 0 1-1.31.003l-.845-3.36a.05.05 0 0 0-.05.039l-.833 3.32a.674.674 0 0 1-.654.511"
    ></Path>
    <Path
      stroke={iconColor}
      strokeLinecap="round"
      strokeWidth={2}
      d="M3 6h35.5m-5 20.5V11h-15v15.5z"
    ></Path>
  </Svg>
)};

export default IconeIcon;
