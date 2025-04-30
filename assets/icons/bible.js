// BibleIcon.js
import * as React from "react";
import Svg, { Path } from "react-native-svg";
// Opcional: PropTypes para checagem em tempo de execução
import PropTypes from 'prop-types';

const BibleIcon = (props) => {
  // Define a cor a ser usada: prioriza 'color', depois 'stroke', depois o padrão '#fff'
  const iconColor = props.color || props.stroke || "#fff";
  // Define o tamanho: prioriza 'width'/'height', depois 'size', depois o padrão 35
  const iconWidth = props.width || props.size || 35;
  const iconHeight = props.height || props.size || 35;

return(
  <Svg
    xmlns="http://www.w3.org/2000/svg"
    width={iconWidth}   // Usa o tamanho dinâmico
    height={iconHeight} 
    fill="none"
    viewBox="0 0 55 55"
    {...props}
  >
    <Path
        stroke={iconColor} // Usa a cor dinâmica
        strokeLinecap="round"
        strokeWidth={2}
        strokeLinejoin="round"
        d="M3.722 17.405 1 22.873l11.794 2.735.907 1.367 6.35 1.822 2.269-.91M3.722 17.404 14.155 1l7.297 1.466a5.96 5.96 0 0 1 3.052 1.64v0c.652.654 1.13 1.457 1.48 2.312.288.7.64 1.417.872 1.417.338 0 .93-1.522 1.207-2.295.104-.288.266-.552.482-.768v0c.37-.373.874-.582 1.4-.582h.56q.434 0 .851.11l8.2 2.168M3.723 17.405l8.914 1.947a5.3 5.3 0 0 1 2.615 1.433v0q.265.266.489.566l1.136 1.522v1.823l.907-2.278.482-.484a3 3 0 0 1 2.126-.883h.65q.372 0 .731.09l3.27.821M39.556 6.468l4.99 4.557.453-.455-3.629 8.202M39.557 6.468l-5.444 11.393m-4.536 9.57h9.98m-13.609-.456 4.537-5.469h9.072l3.629 5.469L34.567 37z"
    ></Path>
  </Svg>
  );
};

export default BibleIcon;
