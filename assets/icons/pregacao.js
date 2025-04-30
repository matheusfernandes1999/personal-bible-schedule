// PregacaoIcon.js
import * as React from "react";
import Svg, { Path } from "react-native-svg";
// Opcional: PropTypes para checagem em tempo de execução
import PropTypes from 'prop-types';

const PregacaoIcon = (props) => {
  // Define a cor a ser usada: prioriza 'color', depois 'stroke', depois o padrão '#fff'
  const iconColor = props.color || props.stroke || "#fff";
  // Define o tamanho: prioriza 'width'/'height', depois 'size', depois o padrão 35
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
        stroke={iconColor} // Usa a cor dinâmica
        strokeLinecap="round"
        strokeWidth={2}
        d="M19.5 9V1.5h14v14m0 18.5V15.5M24 34l-.5-8-1.5-3v-6.5 0c0-.888.589-1.668 1.442-1.912l1.372-.392a.946.946 0 0 0 .686-.91v0a.95.95 0 0 0-.159-.524l-.505-.758a2 2 0 0 1-.336-1.11V9.07a2 2 0 0 1 .89-1.664l.893-.595a2 2 0 0 1 2.359.103l.607.486A2 2 0 0 1 30 8.96v1.933a2 2 0 0 1-.336 1.11l-.5.75a.98.98 0 0 0-.164.542v0c0 .42.27.794.668.927L33.5 15.5M10.5 34l.5-8m-7.5 8-1-8L1 23.5v-6.528a2 2 0 0 1 .211-.894l.018-.036a2 2 0 0 1 .797-.842l2.467-1.41c.314-.18.507-.513.507-.873v0c0-.267-.106-.523-.295-.711l-.62-.62a2 2 0 0 1-.585-1.414V9.07a2 2 0 0 1 .89-1.664l1-.666a2 2 0 0 1 2.22 0l1 .666A2 2 0 0 1 9.5 9.07v1.324a2 2 0 0 1-.336 1.11l-.474.71c-.124.187-.19.405-.19.629v0c0 .406.218.781.57.983l2.404 1.374a2 2 0 0 1 .797.842l.229.458 1.146 2.674a.5.5 0 0 0 .87.09L17.5 15"
      />
    </Svg>
  );
};

// PropTypes (Opcional, mas recomendado)
PregacaoIcon.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  height: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  size: PropTypes.oneOfType([PropTypes.string, PropTypes.number]), // Prop de conveniência para width/height
  fill: PropTypes.string,
  stroke: PropTypes.string, // Ainda pode ser usado se 'color' não for passado
  color: PropTypes.string,  // Prop primária para cor (comum em libs de navegação)
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]), // Para estilos adicionais no container Svg
};


export default PregacaoIcon;