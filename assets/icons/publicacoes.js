// PublicacoesIcon.js
import * as React from "react";
import Svg, { Path } from "react-native-svg";
import PropTypes from 'prop-types';

const PublicacoesIcon = (props) => {
  // Define a cor a ser usada: prioriza 'color', depois 'stroke', depois o padrão '#fff'
  const iconColor = props.color || props.stroke || "#fff";
  // Define o tamanho: prioriza 'width'/'height', depois 'size', depois o padrão 34
  // Note: Original dimensions are 34x34 (square)
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
        d="M7.5 10.5v-9H14m9 31h10v-31H14m0 0v9M18.5 9H28m-8.5 12h-2m2 4.5h-2m0 0H4.008a3.1 3.1 0 0 1-.99-.16l-.383-.128a1.952 1.952 0 0 1-1.128-2.725l.077-.154a2.25 2.25 0 0 1 1.3-1.127l.194-.065c.28-.093.572-.141.867-.141H17.5m0 4.5V21m0 11.5H4.008a3.1 3.1 0 0 1-.99-.16l-.383-.128a1.952 1.952 0 0 1-1.128-2.725l.077-.154a2.25 2.25 0 0 1 1.3-1.127l.194-.065c.28-.093.572-.141.867-.141H17.5m0 4.5h2m-2 0V28m2 0h-2M14 18H4.008a3.1 3.1 0 0 1-.99-.16l-.383-.128a1.952 1.952 0 0 1-1.128-2.725l.077-.154a2.25 2.25 0 0 1 1.3-1.127l.194-.065c.28-.094.572-.141.867-.141L14 13.64M14 18h2m-2 0v-4.36m2 0h-2"
      />
    </Svg>
  );
};

// PropTypes (Opcional, mas recomendado)
PublicacoesIcon.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Prop de conveniência para width/height
  color: PropTypes.string,  // Prop primária para cor
  stroke: PropTypes.string, // Fallback para cor
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

export default PublicacoesIcon;