// InicioIcon.js
import * as React from "react";
import Svg, { Path } from "react-native-svg";
import PropTypes from 'prop-types';

const InicioIcon = (props) => {
  // Define a cor a ser usada: prioriza 'color', depois 'stroke', depois o padrão '#fff'
  const iconColor = props.color || props.stroke || "#fff";
  // Define o tamanho: prioriza 'width'/'height', depois 'size', depois os padrões originais
  // Note: Original dimensions are 34x32
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
        d="M1.5 17.5 17 1.5l11.5 11.871m4 4.129-4-4.129m-5-5.871v-6h5v11.871"
      />
      <Path
        stroke={iconColor}
        strokeLinecap="round"
        strokeWidth={2}
        d="M6 16v14.5h7.5m15-14.5v14.5H21m0 0v-10h-7.5v10m7.5 0h-7.5"
      />
    </Svg>
  );
};

// PropTypes (Opcional, mas recomendado)
InicioIcon.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Prop de conveniência para width/height
  color: PropTypes.string,  // Prop primária para cor
  stroke: PropTypes.string, // Fallback para cor
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

export default InicioIcon;