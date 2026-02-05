declare module 'react-plotly.js' {
  import { Component } from 'react';

  interface PlotParams {
    data: any[];
    layout?: any;
    config?: any;
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
  }

  class Plot extends Component<PlotParams> {}
  export default Plot;
}

declare module 'plotly.js-dist-min' {
  const Plotly: any;
  export default Plotly;
}
