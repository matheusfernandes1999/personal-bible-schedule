// VidaIcon.js
import * as React from "react";
import Svg, { Path } from "react-native-svg";
import PropTypes from 'prop-types';

const VidaIcon = (props) => {
  // Define a cor a ser usada: prioriza 'color', depois 'stroke', depois o padrão '#fff'
  const iconColor = props.color || props.stroke || "#fff";
  // Define o tamanho: prioriza 'width'/'height', depois 'size', depois os padrões originais
  // Note: Original dimensions are 31x34
  const iconWidth = props.width || props.size || 35;
  const iconHeight = props.height || props.size || 35;

  return (
    <Svg
      width={iconWidth}   // Usa o tamanho dinâmico
      height={iconHeight} // Usa o tamanho dinâmico
      fill="none"
      viewBox="0 0 55 55" // Mantém o viewBox original para escalar corretamente
      {...props} // Espalha outras props (incluindo 'style')
    >
      <Path
        stroke={iconColor}
        strokeLinecap="round"
        strokeWidth={2}
        d="M27 3.5h3V30h-3M24 1v31.5H1V1z"
      />
      <Path
        stroke={iconColor}
        strokeLinecap="round"
        strokeWidth={2}
        d="m8.5 25-3.159-3.159a.2.2 0 0 1 .142-.341h13.582a.2.2 0 0 1 .152.33L16.5 25m-4-6v-3.5M7 19v-2.382a1 1 0 0 1 .553-.894l2.911-1.456A.97.97 0 0 0 11 13.4v0a.97.97 0 0 0-.284-.685l-.223-.223a3.4 3.4 0 0 1-.993-2.398v-.319c0-1.088.615-2.084 1.589-2.57l.127-.064c.8-.4 1.748-.364 2.515.096v0A2.61 2.61 0 0 1 15 9.48v.541a3.57 3.57 0 0 1-1.046 2.525l-.179.179a.94.94 0 0 0-.275.664v0a.94.94 0 0 0 .558.859l3.348 1.488a1 1 0 0 1 .594.914V19"
      />
    </Svg>
  );
};

// PropTypes (Opcional, mas recomendado)
VidaIcon.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Prop de conveniência para width/height
  color: PropTypes.string,  // Prop primária para cor
  stroke: PropTypes.string, // Fallback para cor
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

export default VidaIcon;